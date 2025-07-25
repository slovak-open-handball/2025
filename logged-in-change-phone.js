// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> logged-in-change-phone.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
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
        timerRef.current = null;
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

// Zoznam krajín a ich predvolieb pre telefónne číslo (rozšírený a zoradený)
const countryCodes = [
  { code: 'AF', dialCode: '+93' },
  { code: 'AG', dialCode: '+1‑268' },
  { code: 'AI', dialCode: '+1‑264' },
  { code: 'AL', dialCode: '+355' },
  { code: 'AM', dialCode: '+374' },
  { code: 'AO', dialCode: '+244' },
  { code: 'AQ', dialCode: '+672' },
  { code: 'AR', dialCode: '+54' },
  { code: 'AS', dialCode: '+1‑684' },
  { code: 'AT', dialCode: '+43' },
  { code: 'AU', dialCode: '+61' },
  { code: 'AW', dialCode: '+297' },
  { code: 'AZ', dialCode: '+994' },
  { code: 'BA', dialCode: '+387' },
  { code: 'BB', dialCode: '+1‑246' },
  { code: 'BD', dialCode: '+880' },
  { code: 'BE', dialCode: '+32' },
  { code: 'BF', dialCode: '+226' },
  { code: 'BG', dialCode: '+359' },
  { code: 'BH', dialCode: '+973' },
  { code: 'BI', dialCode: '+257' },
  { code: 'BJ', dialCode: '+229' },
  { code: 'BL', dialCode: '+590' },
  { code: 'BM', dialCode: '+1‑441' },
  { code: 'BN', dialCode: '+673' },
  { code: 'BO', dialCode: '+591' },
  { code: 'BR', dialCode: '+55' },
  { code: 'BS', dialCode: '+1‑242' },
  { code: 'BT', dialCode: '+975' },
  { code: 'BW', dialCode: '+267' },
  { code: 'BY', dialCode: '+375' },
  { code: 'CA', dialCode: '+1' },
  { code: 'CD', dialCode: '+243' },
  { code: 'CF', dialCode: '+236' },
  { code: 'CG', dialCode: '+242' }, // Duplicitný kód, ale rôzne dialCode pre CG
  { code: 'CH', dialCode: '+41' },
  { code: 'CI', dialCode: '+225' },
  { code: 'CK', dialCode: '+682' },
  { code: 'CL', dialCode: '+56' },
  { code: 'CM', dialCode: '+237' },
  { code: 'CN', dialCode: '+86' },
  { code: 'CO', dialCode: '+57' },
  { code: 'CR', dialCode: '+506' },
  { code: 'CU', dialCode: '+53' },
  { code: 'CV', dialCode: '+238' },
  { code: 'CW', dialCode: '+599' },
  { code: 'CY', dialCode: '+357' },
  { code: 'CZ', dialCode: '+420' },
  { code: 'DE', dialCode: '+49' },
  { code: 'DJ', dialCode: '+253' },
  { code: 'DK', dialCode: '+45' },
  { code: 'DM', dialCode: '+1‑767' },
  { code: 'DO', dialCode: '+1‑809' }, // Duplicitný kód, ale rôzne dialCode pre DO
  { code: 'EC', dialCode: '+593' },
  { code: 'EE', dialCode: '+372' },
  { code: 'EG', dialCode: '+20' },
  { code: 'EH', dialCode: '+212' },
  { code: 'ER', dialCode: '+291' },
  { code: 'ES', dialCode: '+34' },
  { code: 'ET', dialCode: '+251' },
  { code: 'FI', dialCode: '+358' },
  { code: 'FJ', dialCode: '+679' },
  { code: 'FK', dialCode: '+500' },
  { code: 'FM', dialCode: '+691' },
  { code: 'FO', dialCode: '+298' },
  { code: 'FR', dialCode: '+33' },
  { code: 'GA', dialCode: '+241' },
  { code: 'GB', dialCode: '+44' },
  { code: 'GE', dialCode: '+995' },
  { code: 'GH', dialCode: '+233' },
  { code: 'GI', dialCode: '+350' },
  { code: 'GL', dialCode: '+299' },
  { code: 'GM', dialCode: '+220' },
  { code: 'GN', dialCode: '+224' },
  { code: 'GQ', dialCode: '+240' },
  { code: 'GR', dialCode: '+30' },
  { code: 'GT', dialCode: '+502' },
  { code: 'GU', dialCode: '+1‑671' },
  { code: 'GW', dialCode: '+245' },
  { code: 'GY', dialCode: '+592' },
  { code: 'HK', dialCode: '+852' },
  { code: 'HN', dialCode: '+504' },
  { code: 'HR', dialCode: '+385' },
  { code: 'HT', dialCode: '+509' },
  { code: 'HU', dialCode: '+36' },
  { code: 'ID', dialCode: '+62' },
  { code: 'IE', dialCode: '+353' },
  { code: 'IL', dialCode: '+972' },
  { code: 'IM', dialCode: '+44‑1624' },
  { code: 'IN', dialCode: '+91' },
  { code: 'IQ', dialCode: '+964' },
  { code: 'IR', dialCode: '+98' },
  { code: 'IS', dialCode: '+354' },
  { code: 'IT', dialCode: '+39' },
  { code: 'JE', dialCode: '+44‑1534' },
  { code: 'JM', dialCode: '+1‑876' },
  { code: 'JO', dialCode: '+962' },
  { code: 'JP', dialCode: '+81' },
  { code: 'KE', dialCode: '+254' },
  { code: 'KG', dialCode: '+996' },
  { code: 'KH', dialCode: '+855' },
  { code: 'KI', dialCode: '+686' },
  { code: 'KN', dialCode: '+1‑869' },
  { code: 'KR', dialCode: '+82' },
  { code: 'KW', dialCode: '+965' },
  { code: 'KY', dialCode: '+1‑345' },
  { code: 'KZ', dialCode: '+7' },
  { code: 'LA', dialCode: '+856' },
  { code: 'LB', dialCode: '+961' },
  { code: 'LC', dialCode: '+1‑758' },
  { code: 'LI', dialCode: '+423' },
  { code: 'LK', dialCode: '+94' },
  { code: 'LR', dialCode: '+231' },
  { code: 'LS', dialCode: '+266' },
  { code: 'LT', dialCode: '+370' },
  { code: 'LU', dialCode: '+352' },
  { code: 'LV', dialCode: '+371' },
  { code: 'LY', dialCode: '+218' },
  { code: 'MA', dialCode: '+212' },
  { code: 'MC', dialCode: '+377' },
  { code: 'MD', dialCode: '+373' },
  { code: 'ME', dialCode: '+382' },
  { code: 'MF', dialCode: '+590' },
  { code: 'MG', dialCode: '+261' },
  { code: 'MH', dialCode: '+692' },
  { code: 'MK', dialCode: '+389' },
  { code: 'ML', dialCode: '+223' },
  { code: 'MM', dialCode: '+95' },
  { code: 'MN', dialCode: '+976' },
  { code: 'MP', dialCode: '+1‑670' },
  { code: 'MR', dialCode: '+222' },
  { code: 'MS', dialCode: '+1‑664' },
  { code: 'MT', dialCode: '+356' },
  { code: 'MU', dialCode: '+230' },
  { code: 'MV', dialCode: '+960' },
  { code: 'MX', dialCode: '+52' },
  { code: 'MZ', dialCode: '+258' },
  { code: 'NA', dialCode: '+264' },
  { code: 'NC', dialCode: '+687' },
  { code: 'NE', dialCode: '+227' },
  { code: 'NG', dialCode: '+234' },
  { code: 'NI', dialCode: '+505' },
  { code: 'NL', dialCode: '+31' },
  { code: 'NO', dialCode: '+47' },
  { code: 'NP', dialCode: '+977' },
  { code: 'NR', dialCode: '+674' },
  { code: 'NU', dialCode: '+683' },
  { code: 'OM', dialCode: '+968' },
  { code: 'PA', dialCode: '+507' },
  { code: 'PE', dialCode: '+51' },
  { code: 'PF', dialCode: '+689' },
  { code: 'PG', dialCode: '+675' },
  { code: 'PH', dialCode: '+63' },
  { code: 'PK', dialCode: '+92' },
  { code: 'PL', dialCode: '+48' },
  { code: 'PM', dialCode: '+508' },
  { code: 'PN', dialCode: '+64' },
  { code: 'PR', dialCode: '+1‑787' },
  { code: 'PS', dialCode: '+970' },
  { code: 'PT', dialCode: '+351' },
  { code: 'PY', dialCode: '+595' },
  { code: 'QA', dialCode: '+974' },
  { code: 'RE', dialCode: '+262' },
  { code: 'RO', dialCode: '+40' },
  { code: 'RS', dialCode: '+381' },
  { code: 'RU', dialCode: '+7' },
  { code: 'RW', dialCode: '+250' },
  { code: 'SA', dialCode: '+966' },
  { code: 'SB', dialCode: '+677' },
  { code: 'SC', dialCode: '+248' },
  { code: 'SD', dialCode: '+249' },
  { code: 'SE', dialCode: '+46' },
  { code: 'SG', dialCode: '+65' },
  { code: 'SH', dialCode: '+290' },
  { code: 'SI', dialCode: '+386' },
  { code: 'SK', dialCode: '+421' },
  { code: 'SL', dialCode: '+232' },
  { code: 'SM', dialCode: '+378' },
  { code: 'SN', dialCode: '+221' },
  { code: 'SO', dialCode: '+252' },
  { code: 'SS', dialCode: '+211' },
  { code: 'ST', dialCode: '+239' },
  { code: 'SR', dialCode: '+597' },
  { code: 'SV', dialCode: '+503' },
  { code: 'SX', dialCode: '+1‑721' },
  { code: 'SY', dialCode: '+963' },
  { code: 'TD', dialCode: '+235' },
  { code: 'TG', dialCode: '+228' },
  { code: 'TH', dialCode: '+66' },
  { code: 'TJ', dialCode: '+992' },
  { code: 'TK', dialCode: '+690' },
  { code: 'TM', dialCode: '+993' },
  { code: 'TN', dialCode: '+216' },
  { code: 'TO', dialCode: '+676' },
  { code: 'TR', dialCode: '+90' },
  { code: 'TT', dialCode: '+1‑868' },
  { code: 'TV', dialCode: '+688' },
  { code: 'TW', dialCode: '+886' },
  { code: 'TZ', dialCode: '+255' },
  { code: 'UA', dialCode: '+380' },
  { code: 'UG', dialCode: '+256' },
  { code: 'US', dialCode: '+1' },
  { code: 'UY', dialCode: '+598' },
  { code: 'UZ', dialCode: '+998' },
  { code: 'VA', dialCode: '+379' },
  { code: 'VC', dialCode: '+1‑784' },
  { code: 'VE', dialCode: '+58' },
  { code: 'VN', dialCode: '+84' },
  { code: 'VU', dialCode: '+678' },
  { code: 'WF', dialCode: '+681' },
  { code: 'WS', dialCode: '+685' },
  { code: 'XK', dialCode: '+383' },
  { code: 'YE', dialCode: '+967' },
  { code: 'YT', dialCode: '+262' },
  { code: 'ZA', dialCode: '+27' },
  { code: 'ZM', dialCode: '+260' },
  { code: 'ZW', dialCode: '+263' },
].sort((a, b) => a.code.localeCompare(b.code)); // Zoradenie podľa kódu krajiny

// CountryCodeModal Component
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCountries = countryCodes.filter(country =>
    country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dialCode.includes(searchTerm)
  );

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content', ref: modalRef },
      React.createElement(
        'h3',
        { className: 'text-xl font-bold mb-4' },
        'Vybrať predvoľbu krajiny'
      ),
      React.createElement('input', {
        type: 'text',
        placeholder: 'Hľadať kód krajiny alebo predvoľbu...',
        className: 'w-full p-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
      }),
      React.createElement(
        'div',
        { className: 'max-h-60 overflow-y-auto border border-gray-200 rounded-lg' },
        filteredCountries.map((country) =>
          React.createElement(
            'div',
            {
              key: country.code,
              className: `p-2 cursor-pointer hover:bg-blue-100 ${selectedCode === country.dialCode ? 'bg-blue-200 font-semibold' : ''}`,
              onClick: () => {
                onSelect(country.dialCode);
                onClose();
              },
            },
            `${country.code} (${country.dialCode})` // Zobrazenie kódu krajiny a predvoľby
          )
        )
      ),
      React.createElement(
        'button',
        {
          onClick: onClose,
          className: 'mt-4 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg w-full transition-colors duration-200',
        },
        'Zavrieť'
      )
    )
  );
}

// Main React component for the logged-in-change-phone.html page
function ChangePhoneApp() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');
  const [email, setEmail] = React.useState(''); // Bude nastavený z user.email alebo userProfileData.email
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);

  // States for country code selection
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Default to Slovakia

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("ChangePhoneApp: Firebase SDK nie je načítané.");
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-change-phone.html.");
        setLoading(false);
        return;
      }

      let firebaseApp;
      // Skontrolujte, či už existuje predvolená aplikácia Firebase
      if (firebase.apps.length === 0) {
        // Používame globálne __firebase_config
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      } else {
        firebaseApp = firebase.app(); // Použite existujúcu predvolenú aplikáciu
      }
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          }
        } catch (e) {
          console.error("ChangePhoneApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("ChangePhoneApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Mark auth as ready after the first check
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("ChangePhoneApp: Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (isAuthReady && db && user !== undefined) {
      if (user === null) {
        console.log("ChangePhoneApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return;
      }

      if (user) {
        console.log(`ChangePhoneApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
        setLoading(true);

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            console.log("ChangePhoneApp: onSnapshot pre používateľský dokument spustený.");
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("ChangePhoneApp: Používateľský dokument existuje, dáta:", userData);

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("ChangePhoneApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                  console.log("ChangePhoneApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                  return;
              }

              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`ChangePhoneApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangePhoneApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  console.log("ChangePhoneApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  console.warn("ChangePhoneApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                  auth.signOut();
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("ChangePhoneApp: Timestampy sú rovnaké, aktualizujem localStorage.");
              }
              // --- KONIEC LOGIKY ODHLÁSENIA ---

              setUserProfileData(userData);
              
              // Aktualizujeme lokálne stavy z userProfileData
              // Rozdelíme telefónne číslo na predvoľbu a samotné číslo
              const fullPhoneNumber = userData.contactPhoneNumber || '';
              let initialDialCode = '+421'; // Predvolená hodnota pre Slovensko
              let initialPhoneNumber = fullPhoneNumber;

              // Skúsime nájsť zhodnú predvoľbu a oddeliť ju od čísla
              for (const country of countryCodes) { // Zmenené z COUNTRIES na countryCodes
                if (fullPhoneNumber.startsWith(country.dialCode)) { // Zmenené z dial_code na dialCode
                  initialDialCode = country.dialCode; // Zmenené z dial_code na dialCode
                  initialPhoneNumber = fullPhoneNumber.substring(country.dialCode.length); // Zmenené z dial_code na dialCode
                  break;
                }
              }
              setSelectedCountryDialCode(initialDialCode);
              setContactPhoneNumber(initialPhoneNumber); // Nastavíme len samotné číslo

              setEmail(userData.email || user.email || '');
              setRole(userData.role || 'user');
              setIsApproved(userData.approved || false);
              
              setLoading(false);
              setError('');

              if (typeof window.updateMenuItemsVisibility === 'function') {
                  window.updateMenuItemsVisibility(userData.role);
              }

              console.log("ChangePhoneApp: Načítanie používateľských dát dokončené, loading: false");
            } else {
              console.warn("ChangePhoneApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false);
            }
          }, error => {
            console.error("ChangePhoneApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false);
            console.log("ChangePhoneApp: Načítanie používateľských dát zlyhalo, loading: false");
          });
        } catch (e) {
          console.error("ChangePhoneApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false);
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("ChangePhoneApp: Auth ready, user undefined. Nastavujem loading na false.");
        setLoading(false);
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("ChangePhoneApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`ChangePhoneApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) {
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("ChangePhoneApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else {
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("ChangePhoneApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie.");
      }
    }
  }, [user]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("ChangePhoneApp: Chyba pri odhlásení:", e);
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  const handleUpdatePhoneNumber = async (e) => {
    e.preventDefault();
    if (!db || !user || !userProfileData) {
      setError("Databáza alebo používateľ nie je k dispozícii.");
      return;
    }
    setLoading(true);
    setError('');
    setUserNotificationMessage('');

    // Combine dial code and phone number
    const fullPhoneNumber = selectedCountryDialCode + contactPhoneNumber;

    try {
      const userDocRef = db.collection('users').doc(user.uid);
      await userDocRef.update({
        contactPhoneNumber: fullPhoneNumber, // Save the combined number
      });
      setUserNotificationMessage("Telefónne číslo úspešne aktualizované!");

      // --- Logika pre ukladanie notifikácie pre administrátorov ---
      try {
          // Používame pevne zadané 'default-app-id' pre cestu k notifikáciám
          const appId = 'default-app-id'; 
          let notificationMessage = '';
          let notificationRecipientId = '';

          // Konkrétna správa o zmene telefónneho čísla
          if (userProfileData.role === 'user') {
              notificationMessage = `Používateľ ${userProfileData.email} si zmenil telefónne číslo na ${fullPhoneNumber}.`;
              notificationRecipientId = 'all_admins'; // Notifikácia pre všetkých administrátorov
          } else if (userProfileData.role === 'admin') {
              notificationMessage = `Administrátor ${userProfileData.email} si zmenil telefónne číslo na ${fullPhoneNumber}.`;
              notificationRecipientId = user.uid; // Notifikácia pre tohto konkrétneho administrátora
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notifikácia o zmene telefónneho čísla úspešne uložená do Firestore.");
          }
      } catch (e) {
          console.error("ChangePhoneApp: Chyba pri ukladaní notifikácie o zmene telefónneho čísla:", e);
      }
      // --- Koniec logiky pre ukladania notifikácie ---

    } catch (e) {
      console.error("ChangePhoneApp: Chyba pri aktualizácii telefónneho čísla:", e);
      setError(`Chyba pri aktualizácii telefónneho čísla: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("ChangePhoneApp: Auth je ready a používateľ je null, presmerovávam na login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam aplikáciu...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam používateľské dáta...';
    } else if (loading) {
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Pre používateľov s rolou 'admin' alebo neschválených používateľov, presmerovať na 'logged-in-my-data.html'
  if (userProfileData && (userProfileData.role !== 'user' || userProfileData.approved !== true)) {
    console.log("ChangePhoneApp: Používateľ nie je schválený používateľ, presmerovávam.");
    window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť telefónne číslo' // Hlavný nadpis
        ),
        // Change Phone Number Section
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'form',
            { onSubmit: handleUpdatePhoneNumber, className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contact-phone-number' }, 'Telefónne číslo kontaktnej osoby'),
              React.createElement(
                'div',
                { className: 'flex' },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setIsCountryCodeModalOpen(true),
                    className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-l-lg border border-r-0 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 flex-shrink-0',
                    disabled: loading,
                  },
                  selectedCountryDialCode // Zobrazí vybranú predvoľbu
                ),
                React.createElement('input', {
                  type: 'tel', // Používame type="tel" pre telefónne čísla
                  id: 'contact-phone-number',
                  className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                  value: contactPhoneNumber, // Už len samotné číslo
                  onChange: (e) => setContactPhoneNumber(e.target.value),
                  required: true,
                  disabled: loading,
                  placeholder: 'Zadajte telefónne číslo'
                })
              )
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                disabled: loading,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            )
          )
        )
      )
    ),
    // Country Code Selection Modal
    React.createElement(CountryCodeModal, {
      isOpen: isCountryCodeModalOpen,
      onClose: () => setIsCountryCodeModalOpen(false),
      onSelect: setSelectedCountryDialCode,
      selectedCode: selectedCountryDialCode,
    })
  );
}
