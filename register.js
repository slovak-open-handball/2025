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
import { Page7Form } from './register-page7.js'; // NOVINKA: Import pre Page7Form (pôvodná Page6)

import { getFirestore, doc, onSnapshot, collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";


// Deklarácia globálnych premenných pre Firebase, ak ešte nie sú definované
let db;
let auth;
let app;

// Nastavenie globálnych premenných, ak sú dostupné z Canvas prostredia
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? initialAuthToken : null;


// Inicializácia Firebase a prihlásenie
async function initializeFirebaseAndAuth() {
  try {
    if (!app) { // Inicializovať app len raz
      app = initializeApp(firebaseConfig);
    }
    if (!db) { // Inicializovať db len raz
      db = getFirestore(app);
    }
    if (!auth) { // Inicializovať auth len raz
      auth = getAuth(app);
    }

    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      await signInAnonymously(auth);
    }

    // Nastavenie globálnych premenných pre prístup v iných moduloch
    window.db = db;
    window.auth = auth;
    window.isGlobalAuthReady = true;

    const event = new Event('globalDataUpdated');
    window.dispatchEvent(event);

  } catch (error) {
    console.error("Chyba pri inicializácii Firebase alebo autentifikácii:", error);
    // V prípade chyby môžete zobraziť správu používateľovi alebo vykonať inú akciu
  }
}

// Spustenie inicializácie Firebase a autentifikácie
initializeFirebaseAndAuth();


function App() {
  const [currentPage, setCurrentPage] = React.useState('page1');
  const [formData, setFormData] = React.useState({
    // Page 1
    email: '',
    password: '',
    passwordConfirm: '',
    phonePrefix: '',
    phoneNumber: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    country: '',
    gender: '',
    // Page 2
    billingSameAsContact: true,
    billingDetails: {
      companyName: '',
      ico: '',
      dic: '',
      icDph: '',
      street: '',
      city: '',
      postalCode: '',
      country: ''
    },
    // Page 3
    selectedCategories: {}, // { categoryName: numTeams, ... }
    // Page 4 details for teams and t-shirts (managed separately to simplify state)
    // teamsDataFromPage4: { categoryName: [{ teamName: '', players: N, womenTeamMembers: N, menTeamMembers: N, tshirts: [{ size: '', quantity: N }] }], ... }
    // Page 5 will add accommodation, arrival, package to teamsDataFromPage4
    // Page 6 will add player/staff details to teamsDataFromPage4
  });

  const [teamsDataFromPage4, setTeamsDataFromPage4] = React.useState({});

  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [notificationType, setNotificationType] = React.useState('info'); // 'info', 'success', 'error'
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false);

  const [isRecaptchaReady, setIsRecaptchaReady] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Default pre Slovenskú republiku

  const [categoriesData, setCategoriesData] = React.useState({});
  const [isCategoriesLoaded, setIsCategoriesLoaded] = React.useState(false);

  const [registrationStart, setRegistrationStart] = React.useState(null);
  const [registrationEnd, setRegistrationEnd] = React.useState(null);
  const [countdown, setCountdown] = React.useState('');
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(false);

  const [numberOfPlayersLimit, setNumberOfPlayersLimit] = React.useState(0);
  const [numberOfTeamMembersLimit, setNumberOfTeamMembersLimit] = React.useState(0);

  const [tournamentStartDate, setTournamentStartDate] = React.useState(null);
  const [tournamentEndDate, setTournamentEndDate] = React.useState(null);


  // Načítanie globálnych nastavení pre registráciu a limity
  React.useEffect(() => {
    let unsubscribeRegistration;
    let unsubscribeLimits;

    const fetchGlobalSettings = () => {
      if (!window.db) {
        console.log("Firestore DB nie je zatiaľ k dispozícii pre globálne nastavenia.");
        setTimeout(fetchGlobalSettings, 100);
        return;
      }
      try {
        const registrationDocRef = doc(window.db, 'settings', 'registration');
        unsubscribeRegistration = onSnapshot(registrationDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            const startTimestamp = data.startRegistration instanceof Timestamp ? data.startRegistration.toDate() : null;
            const endTimestamp = data.endRegistration instanceof Timestamp ? data.endRegistration.toDate() : null;
            const tournamentStartTimestamp = data.tournamentStart instanceof Timestamp ? data.tournamentStart.toDate() : null;
            const tournamentEndTimestamp = data.tournamentEnd instanceof Timestamp ? data.tournamentEnd.toDate() : null;

            setRegistrationStart(startTimestamp);
            setRegistrationEnd(endTimestamp);
            setTournamentStartDate(tournamentStartTimestamp);
            setTournamentEndDate(tournamentEndTimestamp);
          } else {
            console.warn("Dokument /settings/registration neexistuje.");
            setRegistrationStart(null);
            setRegistrationEnd(null);
            setTournamentStartDate(null);
            setTournamentEndDate(null);
          }
        }, (error) => {
          console.error("Chyba pri načítaní nastavení registrácie:", error);
        });

        const limitsDocRef = doc(window.db, 'settings', 'limits');
        unsubscribeLimits = onSnapshot(limitsDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setNumberOfPlayersLimit(data.numberOfPlayers || 0);
            setNumberOfTeamMembersLimit(data.numberOfTeamMembers || 0);
          } else {
            console.warn("Dokument /settings/limits neexistuje.");
            setNumberOfPlayersLimit(0);
            setNumberOfTeamMembersLimit(0);
          }
        }, (error) => {
          console.error("Chyba pri načítaní limitov:", error);
        });

      } catch (e) {
        console.error("Chyba pri nastavovaní poslucháča pre globálne nastavenia:", e);
      }
    };

    fetchGlobalSettings();

    return () => {
      if (unsubscribeRegistration) {
        unsubscribeRegistration();
      }
      if (unsubscribeLimits) {
        unsubscribeLimits();
      }
    };
  }, []);

  // Timer pre odpočet a kontrolu otvorenia/zatvorenia registrácie
  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      let open = false;
      let countdownString = '';

      if (registrationStart && registrationEnd) {
        if (now < registrationStart) {
          const diff = registrationStart.getTime() - now.getTime();
          countdownString = formatCountdown(diff);
          open = false; // Ešte nie je otvorená
        } else if (now >= registrationStart && now <= registrationEnd) {
          const diff = registrationEnd.getTime() - now.getTime();
          countdownString = formatCountdown(diff);
          open = true; // Je otvorená
        } else {
          countdownString = 'Registrácia je ukončená.';
          open = false; // Je ukončená
        }
      } else {
        countdownString = 'Informácie o registrácii nie sú dostupné.';
        open = false;
      }
      setCountdown(countdownString);
      setIsRegistrationOpen(open);

      // Ak je registrácia ukončená a používateľ nie je na stránke 7 (potvrdenie), presmeruj na stránku 1
      if (!open && currentPage !== 'page7' && currentPage !== 'page1') {
        setCurrentPage('page1'); // Automaticky presmeruje na úvodnú stránku
        setNotificationMessage('Registrácia je momentálne zatvorená.', 'error');
        setNotificationType('error');
      }

    }, 1000); // Aktualizovať každú sekundu

    return () => clearInterval(timer);
  }, [registrationStart, registrationEnd, currentPage]);

  const formatCountdown = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  };


  React.useEffect(() => {
    if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise && grecaptcha.enterprise.ready) {
      grecaptcha.enterprise.ready(function() {
        setIsRecaptchaReady(true);
      });
    } else {
      // Fallback for local development or if enterprise not available
      grecaptcha.ready(function() {
        setIsRecaptchaReady(true);
      });
    }
  }, []);


  const closeNotification = () => {
    setNotificationMessage('');
    setNotificationType('info');
  };

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prevData => ({ ...prevData, [id]: checked }));
    } else if (id.startsWith('billingDetails.')) {
      const field = id.split('.')[1];
      setFormData(prevData => ({
        ...prevData,
        billingDetails: {
          ...prevData.billingDetails,
          [field]: value
        }
      }));
    } else {
      setFormData(prevData => ({ ...prevData, [id]: value }));
    }
  };

  // NOVINKA: Funkcia pre granulárnu aktualizáciu dát tímov
  const onGranularTeamsDataChange = React.useCallback((categoryName, teamIndex, field, value) => {
    setTeamsDataFromPage4(prevTeamsData => {
      const newTeamsData = { ...prevTeamsData };
      if (!newTeamsData[categoryName]) {
        newTeamsData[categoryName] = [];
      }
      // Inicializácia tímu, ak neexistuje
      if (!newTeamsData[categoryName][teamIndex]) {
        newTeamsData[categoryName][teamIndex] = {
          teamName: '', players: '', womenTeamMembers: '', menTeamMembers: '', tshirts: [{ size: '', quantity: '' }],
          accommodation: { type: '' }, arrival: { type: '', time: null, drivers: null }, packageId: '', packageDetails: null,
          playersDetails: [], staffDetails: []
        };
      }

      // Špeciálne spracovanie pre vnorené objekty (accommodation, arrival)
      if (field === 'accommodation' || field === 'arrival') {
        newTeamsData[categoryName][teamIndex][field] = {
          ...newTeamsData[categoryName][teamIndex][field],
          ...value // Zlúčenie s existujúcimi dátami
        };
      } else {
        newTeamsData[categoryName][teamIndex][field] = value;
      }
      return newTeamsData;
    });
  }, []);


  const handleNextPage1 = (data) => {
    setLoading(true);
    setFormData(prevData => ({ ...prevData, ...data }));
    setCurrentPage('page2');
    setLoading(false);
  };

  const handleNextPage2 = (data) => {
    setLoading(true);
    setFormData(prevData => ({ ...prevData, ...data }));
    setCurrentPage('page3');
    setLoading(false);
  };

  const handleNextPage3 = (data, teamsInitialData) => {
    setLoading(true);
    setFormData(prevData => ({ ...prevData, selectedCategories: data }));
    setTeamsDataFromPage4(teamsInitialData); // Nastavenie počiatočných dát pre tímy
    setCurrentPage('page4');
    setLoading(false);
  };

  const handleNextPage4 = (data) => {
    setLoading(true);
    setTeamsDataFromPage4(data); // Aktualizácia s detailmi z Page4
    setCurrentPage('page5');
    setLoading(false);
  };

  const handleNextPage5 = (data) => {
    setLoading(true);
    setTeamsDataFromPage4(data); // Aktualizácia s detailmi z Page5
    setCurrentPage('page6');
    setLoading(false);
  };

  const handleNextPage6 = (data) => { // NOVINKA: handleNextPage6
    setLoading(true);
    setTeamsDataFromPage4(data); // Aktualizácia s detailmi z Page6
    setCurrentPage('page7');
    setLoading(false);
  };

  // Upravená handlePrev funkcia na prijímanie voliteľných aktualizovaných dát
  const handlePrev = ({ currentFormData, currentTeamsDataFromPage4 }) => { // <--- ZMENA TU: Prijíma objekt s dátami
    setLoading(true);
    let newCurrentPage = currentPage;
    if (currentPage === 'page2') {
      newCurrentPage = 'page1';
    } else if (currentPage === 'page3') {
      newCurrentPage = 'page2';
    } else if (currentPage === 'page4') {
      newCurrentPage = 'page3';
    } else if (currentPage === 'page5') {
      newCurrentPage = 'page4';
    } else if (currentPage === 'page6') {
      newCurrentPage = 'page5';
    } else if (currentPage === 'page7') {
      newCurrentPage = 'page6';
    }
    setCurrentPage(newCurrentPage);

    // Aktualizácia formData a teamsDataFromPage4 so stavom z opúšťanej stránky
    setFormData(currentFormData);
    setTeamsDataFromPage4(currentTeamsDataFromPage4);

    setLoading(false);
  };


  const handleSubmitFinal = async (finalTeamsData) => {
    setLoading(true);
    setNotificationMessage('');
    setNotificationType('info');

    try {
      // Zlúčenie formData a finalTeamsData pre konečné odoslanie
      const finalData = {
        ...formData,
        teamsData: finalTeamsData, // Pridanie detailov tímov
        registrationDate: new Date() // Dátum a čas registrácie
      };

      // Odstránenie citlivých údajov pred odoslaním na Google Apps Script
      const dataToSend = { ...finalData };
      delete dataToSend.password;
      delete dataToSend.passwordConfirm;

      // Odoslanie dát na Google Apps Script
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        let errorMessage = 'Nastala chyba pri odosielaní formulára.';
        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch (parseError) {
          // Ak sa nepodarí parsovať JSON, použijeme všeobecnú správu
          console.error("Chyba pri parsovaní chybovej odpovede:", parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.status === 'success') {
        setRegistrationSuccess(true);
        setNotificationMessage('Registrácia bola úspešne odoslaná!', 'success');
        setNotificationType('success');
        // Tu by ste mohli presmerovať používateľa na ďakovnú stránku alebo zobraziť potvrdenie
      } else {
        setNotificationMessage(result.message || 'Nastala chyba pri registrácii.', 'error');
        setNotificationType('error');
      }
    } catch (error) {
      console.error('Chyba pri odosielaní formulára:', error);
      setNotificationMessage(error.message || 'Nepodarilo sa odoslať registráciu.', 'error');
      setNotificationType('error');
    } finally {
      setLoading(false);
    }
  };


  // Načítanie kategórií z Firestore
  React.useEffect(() => {
    let unsubscribeCategories;
    const fetchCategories = () => {
      if (!window.db) {
        console.log("Firestore DB nie je zatiaľ k dispozícii pre kategórie.");
        setTimeout(fetchCategories, 100);
        return;
      }
      try {
        const categoriesCollection = collection(window.db, 'categories');
        const q = query(categoriesCollection, where('isPublished', '==', true)); // Filter len publikované kategórie
        unsubscribeCategories = onSnapshot(q, (snapshot) => {
          const fetchedCategories = {};
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            fetchedCategories[doc.id] = {
              name: data.name,
              minTeams: data.minTeams,
              maxTeams: data.maxTeams,
              categoryOrder: data.categoryOrder || 0 // Pre zoradenie
            };
          });

          // Zoradenie kategórií podľa categoryOrder
          const sortedCategoryNames = Object.keys(fetchedCategories).sort((a, b) => {
            return fetchedCategories[a].categoryOrder - fetchedCategories[b].categoryOrder;
          });

          const sortedFetchedCategories = {};
          sortedCategoryNames.forEach(name => {
            sortedFetchedCategories[name] = fetchedCategories[name];
          });

          setCategoriesData(sortedFetchedCategories);
          setIsCategoriesLoaded(true);
          const event = new Event('categoriesLoaded');
          window.dispatchEvent(event);

        }, (error) => {
          console.error("Chyba pri načítaní kategórií:", error);
          setNotificationMessage("Chyba pri načítaní kategórií.", 'error');
          setNotificationType('error');
        });
      } catch (e) {
        console.error("Chyba pri nastavovaní poslucháča pre kategórie:", e);
      }
    };

    fetchCategories();

    return () => {
      if (unsubscribeCategories) {
        unsubscribeCategories();
      }
    };
  }, []); // Prázdne pole závislostí zabezpečí, že sa effect spustí iba raz pri mountnutí komponentu


  if (registrationSuccess) {
    return React.createElement(
      'div',
      { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center' },
        React.createElement('svg', { className: 'mx-auto h-16 w-16 text-green-500 mb-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
        ),
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold text-gray-800 mb-4' },
          'Registrácia úspešná!'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-600 mb-6' },
          'Ďakujeme za vašu registráciu. Na vami zadanú e-mailovú adresu boli odoslané podrobnosti.'
        ),
        React.createElement(
          'button',
          {
            onClick: () => {
              setRegistrationSuccess(false);
              setCurrentPage('page1');
              setFormData({ // Reset formulára
                email: '', password: '', passwordConfirm: '', phonePrefix: '', phoneNumber: '',
                firstName: '', lastName: '', birthDate: '', country: '', gender: '',
                billingSameAsContact: true, billingDetails: { companyName: '', ico: '', dic: '', icDph: '', street: '', city: '', postalCode: '', country: '' },
                selectedCategories: {}
              });
              setTeamsDataFromPage4({}); // Reset team data
              closeNotification();
            },
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
          },
          'Nová registrácia'
        )
      )
    );
  }

  // Ak registrácia nie je otvorená a nie je to stránka potvrdenia (strana 7), zobrazte odpočet
  if (!isRegistrationOpen && currentPage !== 'page7') {
    const registrationStartDateObj = registrationStart ? registrationStart : null;
    return React.createElement(
      'div',
      { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center' },
        React.createElement('svg', { className: 'mx-auto h-16 w-16 text-blue-500 mb-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
          React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' })
        ),
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold text-gray-800 mb-4' },
          'Registrácia bude čoskoro spustená!'
        ),
        React.createElement(
          'p',
          { className: 'text-gray-600 mb-4' },
          React.createElement(
            'p',
            { className: 'text-md text-gray-700' },
            'Registrácia začína ',
            registrationStartDateObj && (
              React.createElement(
                'strong',
                null,
                registrationStartDateObj.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                ' o ',
                registrationStartDateObj.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
                ' hod.'
              )
            )
          ),
          countdown && (
              React.createElement('p', { className: 'text-md text-gray-700 mt-2' }, React.createElement('strong', null, `Zostáva: ${countdown}`))
          )
        )
      )
    );
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-3xl' },
      // Modálne okno pre notifikácie (zobrazenie na všetkých stránkach)
      React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification, type: notificationType }),

      currentPage === 'page1' &&
      React.createElement(Page1Form, {
        formData: formData,
        handleChange: handleChange,
        handleNextPage1: handleNextPage1,
        loading: loading,
        setLoading: setLoading,
        setNotificationMessage: setNotificationMessage,
        setShowNotification: setShowNotification,
        setNotificationType: setNotificationType,
        isRecaptchaReady: isRecaptchaReady,
        selectedCountryDialCode: selectedCountryDialCode,
        setSelectedCountryDialCode: setSelectedCountryDialCode,
        // Tu nie je potrebné posielať teamsDataFromPage4 ani setTeamsDataFromPage4,
        // pretože Page1Form ich priamo nemení ani ich neodosiela do handlePrev.
        // handleNextPage1 jednoducho prejde na ďalšiu stránku.
      }),

      currentPage === 'page2' &&
      React.createElement(Page2Form, {
        formData: formData,
        handleChange: handleChange,
        handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleNextPage2: handleNextPage2,
        loading: loading,
        setLoading: setLoading,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification,
        NotificationModal: NotificationModal,
        notificationType: notificationType,
        teamsDataFromPage4: teamsDataFromPage4, // Preposielanie teamsDataFromPage4 pre zachovanie stavu
      }),

      currentPage === 'page3' &&
      React.createElement(Page3Form, {
        formData: formData,
        handlePrev: () => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4: teamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleNextPage3: handleNextPage3,
        loading: loading,
        setLoading: setLoading,
        setNotificationMessage: setNotificationMessage,
        setShowNotification: setShowNotification,
        setNotificationType: setNotificationType,
        setRegistrationSuccess: setRegistrationSuccess,
        isRecaptchaReady: isRecaptchaReady,
        selectedCountryDialCode: selectedCountryDialCode,
        NotificationModal: NotificationModal,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification,
        availableCategoriesMap: categoriesData, // Toto sú dostupné kategórie
        selectedCategoryRows: formData.selectedCategories, // Toto sú vybraté kategórie a ich počet tímov
        setSelectedCategoryRows: (newSelectedCategories) => setFormData(prevData => ({ ...prevData, selectedCategories: newSelectedCategories })),
        notificationType: notificationType,
        teamsDataFromPage4: teamsDataFromPage4, // Preposielanie teamsDataFromPage4 pre zachovanie stavu
      }),

      currentPage === 'page4' &&
      React.createElement(Page4Form, {
        formData: formData,
        handlePrev: (currentTeamsDataFromPage4) => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleNextPage4: handleNextPage4,
        loading: loading,
        setLoading: setLoading,
        notificationMessage: notificationMessage,
        setShowNotification: setShowNotification,
        setNotificationType: setNotificationType,
        setRegistrationSuccess: setRegistrationSuccess,
        isRecaptchaReady: isRecaptchaReady,
        selectedCountryDialCode: selectedCountryDialCode,
        NotificationModal: NotificationModal,
        numberOfPlayersLimit: numberOfPlayersLimit,
        numberOfTeamMembersLimit: numberOfTeamMembersLimit,
        teamsDataFromPage4: teamsDataFromPage4,
        setTeamsDataFromPage4: setTeamsDataFromPage4, // Posielame setTeamsDataFromPage4 pre granulárne aktualizácie v Page4Form
        closeNotification: closeNotification
      }),

      currentPage === 'page5' &&
      React.createElement(Page5Form, {
        formData: formData,
        handlePrev: (currentTeamsDataFromPage4) => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleSubmit: handleNextPage5,
        loading: loading,
        setLoading: setLoading,
        setRegistrationSuccess: setRegistrationSuccess,
        handleChange: handleChange,
        teamsDataFromPage4: teamsDataFromPage4,
        setTeamsDataFromPage4: setTeamsDataFromPage4, // Posielame setTeamsDataFromPage4 pre granulárne aktualizácie
        isRecaptchaReady: isRecaptchaReady,
        tournamentStartDate: tournamentStartDate,
        tournamentEndDate: tournamentEndDate,
        onGranularTeamsDataChange: onGranularTeamsDataChange // Prop pre granulárnu aktualizáciu
      }),

      currentPage === 'page6' &&
      React.createElement(Page6Form, {
        formData: formData,
        handlePrev: (currentTeamsDataFromPage4) => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleSubmit: handleNextPage6,
        loading: loading,
        setLoading: setLoading,
        setRegistrationSuccess: setRegistrationSuccess,
        handleChange: handleChange,
        teamsDataFromPage4: teamsDataFromPage4,
        setTeamsDataFromPage4: setTeamsDataFromPage4, // Posielame setTeamsDataFromPage4 pre granulárne aktualizácie
        isRecaptchaReady: isRecaptchaReady,
        numberOfPlayersLimit: numberOfPlayersLimit,
        numberOfTeamMembersLimit: numberOfTeamMembersLimit,
      }),

      currentPage === 'page7' &&
      React.createElement(Page7Form, {
        formData: formData,
        handlePrev: (currentTeamsDataFromPage4) => handlePrev({ currentFormData: formData, currentTeamsDataFromPage4 }), // <--- ZMENA TU: preposiela dáta
        handleSubmit: handleSubmitFinal,
        loading: loading,
        teamsDataFromPage4: teamsDataFromPage4,
      })
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
