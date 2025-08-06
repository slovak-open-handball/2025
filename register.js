// register.js
// Hlavný súbor aplikácie, ktorý spravuje stav a orchestráciu medzi stránkami formulára.
// Táto verzia pridáva kontrolu na inicializáciu po prijatí globalDataUpdated a categoriesLoaded.

// Tieto konštanty sú definované v <head> register.html a sú prístupné globálne.
const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec"; // Predpokladáme, že táto URL je správna pre Apps Script

// Import komponentov pre stránky formulára z ich samostatných súborov
import { Page1Form, PasswordInput, CountryCodeModal } from './register-page1.js';
import { Page2Form } from './register-page2.js';

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


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
  const [userRole, setUserRole] = React.useState('user'); // Predvolená rola
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [notificationType, setNotificationType] = React.useState('info'); // Nový stav pre typ notifikácie
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false); // Nový stav pre úspešnú registráciu

  // Firebase stav - už nie sú potrebné useState, pristupujeme ku globálnym inštanciám
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Stále potrebné pre sledovanie pripravenosti autentifikácie
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);
  const [categoriesExist, setCategoriesExist] = React.useState(true); // NOVINKA: Stav pre existenciu kategórií

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


  // Inicializácia Firebase a autentifikácie
  React.useEffect(() => {
    // Zobrazenie globálneho loaderu pri načítavaní
    if (window.showGlobalLoader) {
      window.showGlobalLoader();
    }

    try {
      // Prístup ku globálnym inštanciám Firebase Auth a Firestore
      const authInstance = window.auth;
      const firestoreDb = window.db;

      if (!authInstance || !firestoreDb) {
        console.error("register.js: Firebase Auth alebo Firestore nie sú globálne dostupné. Skontrolujte register.html.");
        setNotificationMessage('Chyba pri inicializácii aplikácie: Firebase SDK chýba.');
        setShowNotification(true);
        setNotificationType('error');
        // Skrytie loaderu aj pri chybe
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
        return;
      }

      // Používame onAuthStateChanged z globálneho window.auth
      const unsubscribe = window.auth.onAuthStateChanged(async (currentUser) => {
        setIsAuthReady(true); // Nastavíme, že autentifikácia je pripravená
        // Skrytie loaderu po pripravenosti autentifikácie
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
      });

      return () => {
        unsubscribe();
        // Zabezpečenie skrytia loaderu pri odmontovaní komponentu
        if (window.hideGlobalLoader) {
          window.hideGlobalLoader();
        }
      };
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase v register.js:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
      setNotificationType('error');
      // Skrytie loaderu aj pri chybe
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    }
  }, []); // Odstránená závislosť isRegistering, pretože ref je okamžitý

  // Načítanie a počúvanie stavu registrácie a kategórií z Firestore
  React.useEffect(() => {
    const firestoreDb = window.db;
    if (!firestoreDb || !isAuthReady) {
      return;
    }

    // Načítanie nastavení registrácie
    const settingsDocRef = doc(collection(firestoreDb, 'settings'), 'registration');
    const unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
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

    // Načítanie kategórií
    const categoriesDocRef = doc(collection(firestoreDb, 'settings'), 'categories');
    const unsubscribeCategories = onSnapshot(categoriesDocRef, docSnapshot => { 
      if (docSnapshot.exists && Object.keys(docSnapshot.data()).length > 0) { // OPRAVENÉ: docSnap -> docSnapshot
        setCategoriesExist(true);
      } else {
        setCategoriesExist(false);
      }
    }, error => {
      console.error("register.js: Chyba pri načítaní kategórií (onSnapshot):", error);
      // Ak nastane chyba pri načítaní kategórií, predpokladáme, že neexistujú
      setCategoriesExist(false); 
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
  
  // Funkcia na obsluhu odoslania formulára
  const handleRegister = async (e) => {
      e.preventDefault();
      setLoading(true);
      setNotificationMessage('');
      setShowNotification(false);

      if (isRegisteringRef.current) { // Ak už je registrácia v procese, ukončíme to
        setLoading(false);
        return;
      }
      isRegisteringRef.current = true; // Označíme, že registrácia začala

      const firestoreDb = window.db;
      const authInstance = window.auth;

      if (!firestoreDb || !authInstance) {
          console.error("Firebase SDK nie je inicializovaný.");
          setNotificationMessage('Chyba: Aplikácia nie je správne inicializovaná.');
          setShowNotification(true);
          setNotificationType('error');
          setLoading(false);
          isRegisteringRef.current = false;
          return;
      }

      if (formData.password !== formData.confirmPassword) {
          setNotificationMessage('Heslá sa nezhodujú.');
          setShowNotification(true);
          setNotificationType('error');
          setLoading(false);
          isRegisteringRef.current = false;
          return;
      }

      if (!isRecaptchaReady) {
        setNotificationMessage("Čaká sa na reCAPTCHA...");
        setShowNotification(true);
        setNotificationType('info');
        setLoading(false);
        isRegisteringRef.current = false;
        return;
      }

      try {
        // Získanie reCAPTCHA tokenu
        const recaptchaToken = await getRecaptchaToken('registration');
        if (!recaptchaToken) {
          throw new Error('reCAPTCHA token nebol získaný.');
        }

        // Vytvorenie používateľa v Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(authInstance, formData.email, formData.password);
        const user = userCredential.user;

        // Vytvorenie dokumentu pre používateľa v Firestore
        const userDocRef = doc(collection(firestoreDb, 'users'), user.uid);
        await setDoc(userDocRef, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber,
            houseNumber: formData.houseNumber,
            country: formData.country,
            city: formData.city,
            postalCode: formData.postalCode,
            street: formData.street,
            billing: {
              clubName: formData.billing.clubName,
              ico: formData.billing.ico,
              dic: formData.billing.dic,
              icDph: formData.billing.icDph,
            },
            role: userRole,
            registrationTimestamp: serverTimestamp(),
            recaptchaToken: recaptchaToken // Uložíme token pre záznam
        });
        
        // Odhlásime používateľa po úspešnej registrácii
        await signOut(authInstance);

        // Po úspešnej registrácii nastavíme stav na úspech
        setRegistrationSuccess(true);
        setNotificationMessage('Registrácia úspešná! Skontrolujte e-mail pre overenie.');
        setShowNotification(true);
        setNotificationType('success');
      
      } catch (error) {
        console.error("Chyba pri registrácii:", error);
        let errorMessage = "Chyba pri registrácii. Skúste to znova.";
        if (error.code) {
          switch (error.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'E-mail je už používaný. Skúste iný e-mail.';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Neplatný e-mail.';
              break;
            case 'auth/weak-password':
              errorMessage = 'Heslo musí byť dlhšie ako 6 znakov.';
              break;
            default:
              errorMessage = `Chyba pri registrácii: ${error.message}`;
          }
        }
        setNotificationMessage(errorMessage);
        setShowNotification(true);
        setNotificationType('error');
      } finally {
        setLoading(false);
        isRegisteringRef.current = false;
      }
  };

  const handleNextPage = () => {
    // Pred presunom na ďalšiu stránku sa validuje prvá stránka
    if (page === 1) {
        if (!formData.firstName || !formData.lastName || !formData.email || !formData.contactPhoneNumber || !formData.password || !formData.confirmPassword) {
            setNotificationMessage('Prosím, vyplňte všetky povinné polia na prvej stránke.');
            setShowNotification(true);
            setNotificationType('error');
            return;
        }
    }
    setPage(page + 1);
  };
  
  const handlePrevPage = () => {
    setPage(page - 1);
  };

  const mainForm = (
    <div>
        {page === 1 && (
            <Page1Form
                formData={formData}
                handleChange={handleChange}
                onSelectCountryDialCode={(code) => setSelectedCountryDialCode(code)}
                selectedCountryDialCode={selectedCountryDialCode}
                setIsCountryCodeModalOpen={setIsCountryCodeModalOpen}
            />
        )}
        {page === 2 && (
            <Page2Form
                formData={formData}
                handleChange={handleChange}
                onRoleChange={handleRoleChange}
                userRole={userRole}
            />
        )}
        <div className="flex justify-between mt-6">
            {page > 1 && (
                <button
                    onClick={handlePrevPage}
                    className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg shadow-md hover:bg-gray-400 transition-colors"
                >
                    Späť
                </button>
            )}
            {page < 2 && (
                <button
                    onClick={handleNextPage}
                    className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                >
                    Ďalej
                </button>
            )}
            {page === 2 && (
                <button
                    onClick={handleRegister}
                    disabled={loading}
                    className={`ml-auto px-6 py-2 rounded-lg shadow-md transition-colors ${loading ? 'bg-gray-400' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                    {loading ? 'Prebieha registrácia...' : 'Registrovať'}
                </button>
            )}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 font-sans">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-center text-4xl font-extrabold text-gray-800 mb-6">Registrácia do súťaže</h1>

        {/* Notifikácie a odpočítavanie */}
        {countdown && (
          <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg shadow-inner text-center">
            <h2 className="text-xl font-bold">Registrácia sa začína za:</h2>
            <div className="mt-2 text-2xl font-semibold">{countdown}</div>
          </div>
        )}

        {countdownEnd && (
          <div className="mb-6 p-4 bg-blue-100 text-blue-800 rounded-lg shadow-inner text-center">
            <h2 className="text-xl font-bold">Registrácia sa končí za:</h2>
            <div className="mt-2 text-2xl font-semibold">{countdownEnd}</div>
          </div>
        )}
        
        {/* OPRAVENÉ: Zlúčená podmienka pre ukončenú registráciu do jedného bloku */}
        {isRegistrationClosed && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg shadow-inner text-center">
            <h2 className="text-xl font-bold mb-2">Registrácia je ukončená!</h2>
            <p className="text-lg">
              Ďakujeme za váš záujem. Registrácia bola ukončená dňa {registrationEndDate ? new Date(registrationEndDate).toLocaleDateString() : ''} o {registrationEndDate ? new Date(registrationEndDate).toLocaleTimeString() : ''} hod.
            </p>
          </div>
        )}

        {isRegistrationOpen && !registrationSuccess && categoriesExist && !isBeforeRegistrationStart && (
          // Tu je obsah formulára, ktorý už nie je obklopený rámikom
          mainForm
        )}

        {(!isRegistrationOpen || !categoriesExist || registrationSuccess || isBeforeRegistrationStart) && (
          <div className="mt-6 text-center text-gray-600 p-8">
            <p className="text-xl">
              {isBeforeRegistrationStart && "Registrácia sa ešte nezačala."}
              {registrationSuccess && "Vaša registrácia bola úspešná! Ďakujeme."}
              {!categoriesExist && "Registrácia momentálne nie je k dispozícii, pretože nie sú nastavené žiadne kategórie."}
              {(!isBeforeRegistrationStart && !isRegistrationOpen && !isRegistrationClosed) && "Ďakujeme za váš záujem. Registrácia je teraz uzavretá."}
            </p>
          </div>
        )}

      </div>
      <NotificationModal message={notificationMessage} onClose={closeNotification} type={notificationType} />
      {/* CountryCodeModal je tu pre ukážku, mal by byť vyrenderovaný na úrovni Page1Form */}
      {isCountryCodeModalOpen && (
        <CountryCodeModal
          onClose={() => setIsCountryCodeModalOpen(false)}
          onSelect={(code) => {
            setSelectedCountryDialCode(code);
            setIsCountryCodeModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
