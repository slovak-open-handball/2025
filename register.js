// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';
import { Page3Form } from './register-page3.js';
import { Page4Form } from './register-page4.js';

import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = (date.getMinutes()).toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  const [userRole, setUserRole] = React.useState('user');
  const [loading, setLoading] = React.useState(false);
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
      const authInstance = window.auth;
      const firestoreDb = window.db;

      if (!authInstance || !firestoreDb) {
        console.error("register.js: Firebase Auth alebo Firestore nie sú globálne dostupné. Skontrolujte register.html.");
        setNotificationMessage('Chyba pri inicializácii aplikácie: Firebase SDK chýba.');
        setShowNotification(true);
        setNotificationType('error');
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
        return;
      }

      const unsubscribe = window.auth.onAuthStateChanged(async (currentUser) => {
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
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
      setNotificationType('error');
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    }
  }, []);

  React.useEffect(() => {
    const firestoreDb = window.db;
    if (!firestoreDb || !isAuthReady) {
      return;
    }

    const settingsDocRef = doc(collection(firestoreDb, 'settings'), 'registration');
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
          console.log("register.js: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
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

    const categoriesDocRef = doc(collection(firestoreDb, 'settings'), 'categories');
    const unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => { 
      if (docSnapshot.exists() && Object.keys(docSnapshot.data()).length > 0) {
        setCategoriesExist(true);
        setCategoriesDataFromFirestore(docSnapshot.data());
      } else {
        setCategoriesExist(false);
        setCategoriesDataFromFirestore({});
      }
    }, error => {
      console.error("register.js: Chyba pri načítaní kategórií (onSnapshot):", error);
      setCategoriesExist(false); 
      setCategoriesDataFromFirestore({});
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
    setNotificationType('info');
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

    const recaptchaToken = await getRecaptchaToken('page_transition');
    if (!recaptchaToken) {
        setLoading(false);
        return;
    }
    console.log("reCAPTCHA Token pre prechod stránky získaný (klient-side overenie).");
    setPage(2);
    setLoading(false);
  };

  const handleNextPage2ToPage3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');

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

    setPage(3);
    setLoading(false);
  };

  const handleNextPage3ToPage4 = async (categoriesDataFromPage3) => {
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');

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

    console.log("App.js: Transformed categories for Page4:", transformedCategories);

    const newTeamsDataForPage4 = {};
    const clubName = formData.billing.clubName || '';

    Object.keys(transformedCategories).forEach(categoryName => {
        const numTeams = transformedCategories[categoryName].numberOfTeams;
        newTeamsDataForPage4[categoryName] = Array.from({ length: numTeams }).map((_, teamIndex) => {
            const suffix = numTeams > 1 ? ` ${String.fromCharCode('A'.charCodeAt(0) + teamIndex)}` : '';
            const generatedTeamName = `${clubName}${suffix}`;
            
            const existingTeamData = teamsDataFromPage4[categoryName]?.[teamIndex] || {};

            return {
                teamName: generatedTeamName,
                players: existingTeamData.players !== undefined ? existingTeamData.players : '',
                teamMembers: existingTeamData.teamMembers !== undefined ? existingTeamData.teamMembers : '',
                womenTeamMembers: existingTeamData.womenTeamMembers !== undefined ? existingTeamData.womenTeamMembers : '',
                menTeamMembers: existingTeamData.menTeamMembers !== undefined ? existingTeamData.menTeamMembers : '',
                tshirts: existingTeamData.tshirts && existingTeamData.tshirts.length > 0
                    ? existingTeamData.tshirts
                    : [{ size: '', quantity: '' }]
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

  const handlePrev = () => {
    setPage(prevPage => prevPage - 1);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
  };

  const handleFinalSubmit = async (teamsDataToSave) => {
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);
    setNotificationType('info');
    isRegisteringRef.current = true;

    const fullPhoneNumber = `${selectedCountryDialCode} ${formData.contactPhoneNumber}`;
    console.log("Konštruované telefónne číslo pre odoslanie (finálne):", fullPhoneNumber);

    try {
      const authInstance = window.auth;
      const firestoreDb = window.db;

      if (!authInstance || !firestoreDb) {
        setNotificationMessage('Firebase nie je inicializované. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }

      const recaptchaToken = await getRecaptchaToken('register_user');
      if (!recaptchaToken) {
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }
      console.log("reCAPTCHA Token pre registráciu používateľa získaný (klient-side overenie).");

      const userCredential = await createUserWithEmailAndPassword(authInstance, formData.email, formData.password);
      const user = userCredential.user;

      if (!user || !user.uid) {
        console.error("register.js: Používateľský objekt je neplatný po vytvorení účtu. UID nie je k dispozícii.");
        setNotificationMessage('Chyba pri vytváraní používateľského účtu. Skúste to prosím znova.');
        setShowNotification(true);
        setNotificationType('error');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }
      console.log("Používateľ vytvorený v Auth s UID:", user.uid);


      const userDocRef = doc(collection(firestoreDb, 'users'), user.uid);

      console.log("register.js: Pokúšam sa zapísať údaje do Firestore pre UID:", user.uid, "do cesty:", userDocRef.path);
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
      console.log("Údaje používateľa úspešne zapísané do Firestore.");

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
            teams: teamsDataToSave,
          };
          console.log("Odosielam registračný e-mail s payloadom:", JSON.stringify(payload, null, 2));
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
            const responseData = await response.text();
            console.log("Odpoveď z Apps Script (fetch - registračný e-mail) ako text:", responseData);
          } catch (jsonError) {
            console.warn("Nepodarilo sa analyzovať odpoveď z Apps Script (očakávané s 'no-cors' pre JSON):", jsonError);
          }
      } catch (emailError) {
          console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (chyba fetch):", emailError);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      setNotificationMessage(`Ďakujeme za Vašu registráciu na turnaj Slovak Open Handball. Potvrdenie o zaregistrovaní Vášho klubu bolo odoslané na e-mailovú adresu ${formData.email}.`);
      setShowNotification(true);
      setNotificationType('success');
      setRegistrationSuccess(true);

      try {
        await signOut(authInstance);
        console.log("Používateľ úspešne odhlásený po registrácii.");
      } catch (signOutError) {
        console.error("Chyba pri odhlasovaní po registrácii:", signOutError);
      }

      setFormData({
        firstName: '', lastName: '', email: '', contactPhoneNumber: '',
        password: '', confirmPassword: '', houseNumber: '', country: '',
        city: '', postalCode: '', street: '',
        billing: { clubName: '', ico: '', dic: '', icDph: '' }
      });
      setSelectedCategoryRows([{ categoryId: '', teams: 1 }]);
      setTeamsDataFromPage4({});
      setPage(1);

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 5000);

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
              case 'permission-denied':
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
      isRegisteringRef.current = false;
    }
  };

  React.useEffect(() => {
  }, [settingsLoaded, isAuthReady]); 

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    !registrationSuccess && React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

    !settingsLoaded || !isAuthReady ? (
      null
    ) : registrationSuccess ? (
      React.createElement(
        'div',
        { className: 'bg-green-700', text: 'white', p: '8', rounded: 'lg', shadow: 'md', w: 'full', maxW: 'md', text: 'center' },
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-4 text-black' },
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
        page === 1 ?
          React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
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
              registrationEndDate: registrationEndDate
            })
          ) :
        page === 2 ?
          React.createElement(
            'div',
            { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
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
            })
          ) :
        page === 3 ?
            React.createElement(
                'div',
                { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
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
                })
            ) :
        page === 4 ?
            React.createElement(
                'div',
                { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
                React.createElement(Page4Form, {
                    formData: formData,
                    handlePrev: handlePrev,
                    handleSubmit: handleFinalSubmit,
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
                    // Prijímanie funkcií pre notifikácie
                    setNotificationMessage: setNotificationMessage, 
                    setShowNotification: setShowNotification, 
                    setNotificationType: setNotificationType,
                })
            ) : null
      )
    )
  );
}

let appInitialized = false;
let globalDataUpdatedReceived = false;
let categoriesLoadedReceived = false;

function initializeRegistrationApp() {
  if (appInitialized) {
    console.log("register.js: Aplikácia už bola inicializovaná, preskakujem.");
    return;
  }
  
  if (!globalDataUpdatedReceived || !categoriesLoadedReceived) {
    console.log("register.js: Čakám na všetky potrebné udalosti ('globalDataUpdated' a 'categoriesLoaded')...");
    return;
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    appInitialized = true;

    root.render(React.createElement(App, null));
    console.log("register.js: React aplikácia úspešne inicializovaná a renderovaná.");

  } else {
    console.error("register.js: Element s ID 'root' nebol nájdený. React aplikácia nemôže byť renderovaná.");
  }
}

window.addEventListener('globalDataUpdated', () => {
  console.log("register.js: Prijatá udalosť 'globalDataUpdated'.");
  globalDataUpdatedReceived = true;
  initializeRegistrationApp();
});

window.addEventListener('categoriesLoaded', () => {
  console.log("register.js: Prijatá udalosť 'categoriesLoaded'.");
  categoriesLoadedReceived = true;
  initializeRegistrationApp();
});


if (window.isGlobalAuthReady && window.areCategoriesLoaded) {
  console.log("register.js: Všetky globálne dáta a kategórie sú už inicializované. Spúšťam React aplikáciu okamžite.");
  globalDataUpdatedReceived = true;
  categoriesLoadedReceived = true;
  initializeRegistrationApp();
}
