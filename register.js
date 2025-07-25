// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> register.html a sú prístupné globálne.
// Odstránené opakované deklarácie.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa"; // Opravený preklep: RECAPTcha_SITE_KEY na RECAPTCHA_SITE_KEY
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
// Presunuté mimo komponentu App, aby bolo globálne dostupné
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Zoznam krajín a ich predvolieb pre telefónne číslo (rozšírený a zoradený) - SKOPÍROVANÉ Z logged-in-change-phone.js
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
  { code: 'AX', dialCode: '+358' },
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
  { code: 'BQ', dialCode: '+599' },
  { code: 'BR', dialCode: '+55' },
  { code: 'BS', dialCode: '+1‑242' },
  { code: 'BT', dialCode: '+975' },
  { code: 'BW', dialCode: '+267' },
  { code: 'BY', dialCode: '+375' },
  { code: 'BZ', dialCode: '+501' },
  { code: 'CA', dialCode: '+1' },
  { code: 'CC', dialCode: '+61' },
  { code: 'CD', dialCode: '+243' },
  { code: 'CF', dialCode: '+236' },
  { code: 'CG', dialCode: '+242' },
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
  { code: 'CX', dialCode: '+61' },
  { code: 'CY', dialCode: '+357' },
  { code: 'CZ', dialCode: '+420' },
  { code: 'DE', dialCode: '+49' },
  { code: 'DJ', dialCode: '+253' },
  { code: 'DK', dialCode: '+45' },
  { code: 'DM', dialCode: '+1‑767' },
  { code: 'DO', dialCode: '+1‑809' },
  { code: 'DZ', dialCode: '+213' },
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
  { code: 'GD', dialCode: '+1‑473' },
  { code: 'GE', dialCode: '+995' },
  { code: 'GF', dialCode: '+594' },
  { code: 'GG', dialCode: '+44' },
  { code: 'GH', dialCode: '+233' },
  { code: 'GI', dialCode: '+350' },
  { code: 'GL', dialCode: '+299' },
  { code: 'GM', dialCode: '+220' },
  { code: 'GN', dialCode: '+224' },
  { code: 'GP', dialCode: '+590' },
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
  { code: 'IM', dialCode: '+44' },
  { code: 'IN', dialCode: '+91' },
  { code: 'IO', dialCode: '+246' },
  { code: 'IQ', dialCode: '+964' },
  { code: 'IR', dialCode: '+98' },
  { code: 'IS', dialCode: '+354' },
  { code: 'IT', dialCode: '+39' },
  { code: 'JE', dialCode: '+44' },
  { code: 'JM', dialCode: '+1‑876' },
  { code: 'JO', dialCode: '+962' },
  { code: 'JP', dialCode: '+81' },
  { code: 'KE', dialCode: '+254' },
  { code: 'KG', dialCode: '+996' },
  { code: 'KH', dialCode: '+855' },
  { code: 'KI', dialCode: '+686' },
  { code: 'KM', dialCode: '+269' },
  { code: 'KN', dialCode: '+1‑869' },
  { code: 'KP', dialCode: '+850' },
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
  { code: 'MO', dialCode: '+853' },
  { code: 'MP', dialCode: '+1‑670' },
  { code: 'MQ', dialCode: '+596' },
  { code: 'MR', dialCode: '+222' },
  { code: 'MS', dialCode: '+1‑664' },
  { code: 'MT', dialCode: '+356' },
  { code: 'MU', dialCode: '+230' },
  { code: 'MV', dialCode: '+960' },
  { code: 'MW', dialCode: '+265' },
  { code: 'MX', dialCode: '+52' },
  { code: 'MY', dialCode: '+60' },
  { code: 'MZ', dialCode: '+258' },
  { code: 'NA', dialCode: '+264' },
  { code: 'NC', dialCode: '+687' },
  { code: 'NE', dialCode: '+227' },
  { code: 'NF', dialCode: '+672' },
  { code: 'NG', dialCode: '+234' },
  { code: 'NI', dialCode: '+505' },
  { code: 'NL', dialCode: '+31' },
  { code: 'NO', dialCode: '+47' },
  { code: 'NP', dialCode: '+977' },
  { code: 'NR', dialCode: '+674' },
  { code: 'NU', dialCode: '+683' },
  { code: 'NZ', dialCode: '+64' },
  { code: 'OM', dialCode: '+968' },
  { code: 'PA', dialCode: '+507' },
  { code: 'PE', dialCode: '+51' },
  { code: 'PF', dialCode: '+689' },
  { code: 'PG', dialCode: '+675' },
  { code: 'PH', dialCode: '+63' },
  { code: 'PK', dialCode: '+92' },
  { code: 'PL', dialCode: '+48' },
  { code: 'PM', dialCode: '+508' },
  { code: 'PR', dialCode: '+1‑787' },
  { code: 'PS', dialCode: '+970' },
  { code: 'PT', dialCode: '+351' },
  { code: 'PW', dialCode: '+680' },
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
  { code: 'SJ', dialCode: '+47' },
  { code: 'SK', dialCode: '+421' },
  { code: 'SL', dialCode: '+232' },
  { code: 'SM', dialCode: '+378' },
  { code: 'SN', dialCode: '+221' },
  { code: 'SO', dialCode: '+252' },
  { code: 'SR', dialCode: '+597' },
  { code: 'SS', dialCode: '+211' },
  { code: 'ST', dialCode: '+239' },
  { code: 'SV', dialCode: '+503' },
  { code: 'SX', dialCode: '+1‑721' },
  { code: 'SY', dialCode: '+963' },
  { code: 'SZ', dialCode: '+268' },
  { code: 'TC', dialCode: '+1‑649' },
  { code: 'TD', dialCode: '+235' },
  { code: 'TG', dialCode: '+228' },
  { code: 'TH', dialCode: '+66' },
  { code: 'TJ', dialCode: '+992' },
  { code: 'TK', dialCode: '+690' },
  { code: 'TL', dialCode: '+670' },
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
  { code: 'VG', dialCode: '+1‑284' },
  { code: 'VI', dialCode: '+1‑340' },
  { code: 'VN', dialCode: '+84' },
  { code: 'VU', dialCode: '+678' },
  { code: 'WF', dialCode: '+681' },
  { code: 'WS', dialCode: '+685' },
  { code: 'YE', dialCode: '+967' },
  { code: 'YT', dialCode: '+262' },
  { code: 'ZA', dialCode: '+27' },
  { code: 'ZM', dialCode: '+260' },
  { code: 'ZW', dialCode: '+263' },
].sort((a, b) => a.code.localeCompare(b.code)); // Zoradenie podľa kódu krajiny

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
      className: `modal ${show ? 'block' : 'hidden'}`,
      style: { display: show ? 'flex' : 'none' } // Explicitné zobrazenie/skrytie
    },
    React.createElement(
      'div',
      {
        className: `modal-content transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`
      },
      React.createElement(
        'p',
        { className: 'text-lg text-center' },
        message
      ),
      React.createElement(
        'button',
        {
          className: 'mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full',
          onClick: () => {
            setShow(false);
            setTimeout(onClose, 300); // Dajte čas na animáciu pred zatvorením
          }
        },
        'Zavrieť'
      )
    )
  );
}

// CountryCodeModal Component for selecting phone dial code - SKOPÍROVANÉ Z logged-in-change-phone.js
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, disabled }) { // Pridaný disabled prop
  const [searchTerm, setSearchTerm] = React.useState('');
  // Nový stav pre dočasne vybranú predvoľbu
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    // Inicializujeme tempSelectedCode s aktuálnou vybranou predvoľbou, keď sa modal otvorí
    if (isOpen) {
      setTempSelectedCode(selectedCode);
    }
  }, [isOpen, selectedCode]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose(); // Zavrieť bez uloženia, ak sa klikne mimo
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

  // Funkcia pre tlačidlo OK - aplikuje dočasne vybranú predvoľbu a zatvorí modálne okno
  const handleConfirm = () => {
    onSelect(tempSelectedCode); // Aplikuje dočasnú predvoľbu
    onClose(); // Zavrie modálne okno
  };

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { 
        className: 'modal-content bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md mx-auto', 
        ref: modalRef 
      },
      React.createElement(
        'h3',
        { className: 'text-xl font-bold mb-4 text-center' }, 
        'Vyberte predvoľbu krajiny'
      ),
      React.createElement('input', {
        type: 'text',
        placeholder: 'Hľadať podľa kódu alebo predvoľby...', 
        className: 'w-full p-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500',
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
      }),
      React.createElement(
        'div',
        { className: 'grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2' }, // Zmenené na grid-cols-4 a odstránené border
        filteredCountries.map((country) =>
          React.createElement(
            'button', 
            {
              key: country.code,
              // Porovnávame s tempSelectedCode pre vizuálnu indikáciu výberu
              className: `p-2 text-sm rounded-lg border transition-colors duration-200 
                          ${tempSelectedCode === country.dialCode ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-100 hover:bg-blue-200 text-gray-800 border-gray-300'}`, 
              onClick: () => {
                setTempSelectedCode(country.dialCode); // Nastaví dočasnú predvoľbu
              },
              disabled: disabled, // Tlačidlá sú disabled, ak je modálne okno disabled
            },
            `${country.code} ${country.dialCode}` 
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4 mt-6' }, // Tlačidlá OK a Zatvoriť, s mt-6
        React.createElement(
          'button',
          {
            onClick: onClose, // Používame priamo onClose prop, zahodí zmeny
            className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'Zatvoriť' // Zmenený text tlačidla
        ),
        React.createElement(
          'button',
          {
            onClick: handleConfirm, // Voláme handleConfirm, ktorá aplikuje zmeny a zatvorí
            className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'OK'
        )
      )
    )
  );
}


// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) { // Pridaný tabIndex
  // SVG icons for eye (show password) and eye-off (hide password)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu oka (viditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  // Updated EyeOffIcon with a more reliable path
  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Path for the eye with a slash (more robust version)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement(
      'label',
      { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id },
      label
    ),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex // Použitie tabIndex propu
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
          tabIndex: -1 // Zabezpečí, že tlačidlo nie je súčasťou tabulátorového poradia
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-600 text-xs italic mt-1' },
      description
    )
  );
}

// Global Firebase and Firestore instances (initialized once)
let app, auth, db;

// Initialize Firebase and set up auth listener
const initializeFirebase = () => {
  if (typeof firebase !== 'undefined' && typeof __firebase_config !== 'undefined') {
    try {
      // Check if an app with the default name already exists
      let firebaseApp;
      try {
        firebaseApp = firebase.app(); // Tries to get the default app
      } catch (e) {
        // If getting the default app fails, it means it hasn't been initialized
        firebaseApp = firebase.initializeApp(JSON.parse(__firebase_config));
      }

      app = firebaseApp;
      auth = firebase.auth(app);
      db = firebase.firestore(app);

      // Listen for authentication state changes
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          console.log("Firebase Auth State Changed: User is signed in.", user.uid);
          // Optionally, update UI or fetch user-specific data
        } else {
          console.log("Firebase Auth State Changed: No user is signed in.");
        }
      });

      console.log("Firebase initialized successfully in register.js");
    } catch (error) {
      console.error("Error initializing Firebase in register.js:", error);
    }
  } else {
    console.error("Firebase SDK or __firebase_config is not available.");
  }
};

// Call initialization when the script loads
initializeFirebase();

// Page1Form Component
function Page1Form({ formData, handleChange, handleNext, loading, notificationMessage, closeNotification, isCountryCodeModalOpen, setIsCountryCodeModalOpen, setSelectedCountryDialCode, selectedCountryDialCode }) {
  // ChevronDown icon (Lucide React equivalent - inline SVG)
  const ChevronDown = React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/24/04/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: 'lucide lucide-chevron-down h-5 w-5 ml-2'
    },
    React.createElement('path', { d: 'm6 9 6 6 6-6' })
  );

  return React.createElement(
    'div',
    { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
    React.createElement(
      'h2',
      { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
      'Registrácia (1/2)'
    ),
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),
    React.createElement(
      'form',
      { onSubmit: handleNext, className: 'space-y-4' },
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno'),
        React.createElement('input', {
          type: 'text',
          id: 'firstName',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.firstName,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte vaše meno',
          tabIndex: 1
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko'),
        React.createElement('input', {
          type: 'text',
          id: 'lastName',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.lastName,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte vaše priezvisko',
          tabIndex: 2
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'E-mailová adresa'),
        React.createElement('input', {
          type: 'email',
          id: 'email',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.email,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte svoju e-mailovú adresu',
          autoComplete: 'email',
          tabIndex: 3
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo kontaktnej osoby'),
        React.createElement(
          'div',
          { className: 'flex' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-l-lg border border-r-0 border-gray-300 focus:outline-none focus:shadow-outline transition-colors duration-200 flex-shrink-0 flex items-center', // Pridané flex items-center
              onClick: () => setIsCountryCodeModalOpen(true), // Otvorí modálne okno
              tabIndex: 4 // Tab index pre tlačidlo predvoľby
            },
            selectedCountryDialCode || '+XXX', // Zobrazí vybranú predvoľbu
            ChevronDown // Pridanie ikony šípky
          ),
          React.createElement('input', {
            type: 'tel',
            id: 'contactPhoneNumber',
            className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.contactPhoneNumber,
            onChange: handleChange,
            required: true,
            placeholder: 'Zadajte telefónne číslo',
            tabIndex: 5 // Tab index pre samotné telefónne číslo
          })
        )
      ),
      React.createElement(PasswordInput, {
        id: 'password',
        label: 'Heslo',
        value: formData.password,
        onChange: handleChange,
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        placeholder: 'Zadajte heslo',
        autoComplete: 'new-password',
        description: React.createElement(
          React.Fragment,
          null,
          'Heslo musí obsahovať:',
          React.createElement(
            'ul',
            { className: 'list-disc list-inside ml-4' },
            React.createElement('li', null, 'aspoň jedno malé písmeno,'),
            React.createElement('li', null, 'aspoň jedno veľké písmeno,'),
            React.createElement('li', null, 'aspoň jednu číslicu.')
          )
        ),
        tabIndex: 6
      }),
      React.createElement(PasswordInput, {
        id: 'confirmPassword',
        label: 'Potvrdiť heslo',
        value: formData.confirmPassword,
        onChange: handleChange,
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        placeholder: 'Zadajte heslo znova',
        autoComplete: 'new-password',
        tabIndex: 7
      }),
      React.createElement(
        'button',
        {
          type: 'submit',
          className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
          disabled: loading,
          tabIndex: 8
        },
        loading ? React.createElement(
          'div',
          { className: 'flex items-center justify-center' },
          React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
            React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
            React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
          ),
          'Ďalej...'
        ) : 'Ďalej'
      )
    ),
    React.createElement(CountryCodeModal, {
      isOpen: isCountryCodeModalOpen,
      onClose: () => setIsCountryCodeModalOpen(false),
      onSelect: setSelectedCountryDialCode,
      selectedCode: selectedCountryDialCode,
      disabled: loading, // Pass the loading state to disable buttons in modal
    })
  );
}

// Page2Form Component
function Page2Form({ formData, handleChange, handlePrev, handleSubmit, loading, notificationMessage, closeNotification }) {
  // State for reCAPTCHA token
  const [recaptchaToken, setRecaptchaToken] = React.useState('');

  // Effect to load reCAPTCHA and get token
  React.useEffect(() => {
    if (typeof grecaptcha !== 'undefined' && RECAPTCHA_SITE_KEY) {
      grecaptcha.ready(function() {
        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' }).then(function(token) {
          setRecaptchaToken(token);
        });
      });
    }
  }, []);

  return React.createElement(
    'div',
    { className: 'bg-white p-8 rounded-lg shadow-md w-full max-w-md' },
    React.createElement(
      'h2',
      { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
      'Registrácia (2/2)'
    ),
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),
    React.createElement(
      'form',
      { onSubmit: (e) => handleSubmit(e, recaptchaToken), className: 'space-y-4' },
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'billingAddress' }, 'Fakturačná adresa'),
        React.createElement('input', {
          type: 'text',
          id: 'billingAddress',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.billingAddress,
          onChange: handleChange,
          placeholder: 'Ulica a číslo domu',
          tabIndex: 1
        })
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'billingCity' }, 'Mesto'),
        React.createElement('input', {
          type: 'text',
          id: 'billingCity',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.billingCity,
          onChange: handleChange,
          placeholder: 'Mesto',
          tabIndex: 2
        })
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'billingZip' }, 'PSČ'),
        React.createElement('input', {
          type: 'text',
          id: 'billingZip',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.billingZip,
          onChange: handleChange,
          placeholder: 'PSČ',
          tabIndex: 3
        })
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'billingCountry' }, 'Krajina'),
        React.createElement('input', {
          type: 'text',
          id: 'billingCountry',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.billingCountry,
          onChange: handleChange,
          placeholder: 'Krajina',
          tabIndex: 4
        })
      ),
      React.createElement(
        'div',
        { className: 'mb-4' },
        React.createElement(
          'label',
          { className: 'inline-flex items-center' },
          React.createElement('input', {
            type: 'checkbox',
            id: 'isAdmin',
            className: 'form-checkbox h-5 w-5 text-blue-600 rounded-md',
            checked: formData.isAdmin,
            onChange: handleChange,
            tabIndex: 5
          }),
          React.createElement('span', { className: 'ml-2 text-gray-700' }, 'Chcem sa zaregistrovať ako administrátor')
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-between mt-6' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handlePrev,
            className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: loading,
            tabIndex: 6
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: loading,
            tabIndex: 7
          },
          loading ? React.createElement(
            'div',
            { className: 'flex items-center justify-center' },
            React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
              React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
              React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
            ),
            'Registrujem...'
          ) : 'Registrovať sa'
        )
      )
    )
  );
}


// Main App Component for Registration
function App() {
  const [step, setStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    contactPhoneNumber: '',
    password: '',
    confirmPassword: '',
    billingAddress: '',
    billingCity: '',
    billingZip: '',
    billingCountry: '',
    isAdmin: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolená predvoľba pre Slovensko

  const closeNotification = () => setNotificationMessage('');

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value
    }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    const { password, confirmPassword } = formData;

    if (password !== confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú!');
      return;
    }
    if (password.length < 6) {
      setNotificationMessage('Heslo musí mať aspoň 6 znakov!');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno malé písmeno!');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno veľké písmeno!');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jednu číslicu!');
      return;
    }

    setStep(2);
  };

  const handlePrev = () => {
    setStep(1);
  };

  const handleSubmit = async (e, recaptchaToken) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');

    try {
      // 1. Firebase Authentication: Create user with email and password
      const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
      const user = userCredential.user;
      console.log('Firebase user created:', user.uid);

      // 2. Save user profile to Firestore
      const userProfileRef = db.collection('artifacts').doc(__app_id).collection('users').doc(user.uid);
      await userProfileRef.set({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber, // Uloženie s predvoľbou
        role: formData.isAdmin ? 'admin' : 'user', // Nastavenie roly
        billing: {
          address: formData.billingAddress,
          city: formData.billingCity,
          zip: formData.billingZip,
          country: formData.billingCountry,
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('User profile saved to Firestore for:', user.uid);

      // 3. Send registration email via Google Apps Script
      const emailPayload = {
        action: 'sendRegistrationEmail',
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactPhoneNumber: selectedCountryDialCode + formData.contactPhoneNumber, // S predvoľbou
        isAdmin: formData.isAdmin,
        billing: {
          address: formData.billingAddress,
          city: formData.billingCity,
          zip: formData.billingZip,
          country: formData.billingCountry,
        },
        recaptchaToken: recaptchaToken // Pass reCAPTCHA token
      };

      const scriptResponse = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const scriptResult = await scriptResponse.json();

      if (scriptResult.success) {
        setNotificationMessage('Registrácia úspešná! Skontrolujte si e-mail pre potvrdenie.');
        console.log('Email sent successfully:', scriptResult.message);
        // Po úspešnej registrácii presmerovať alebo vyčistiť formulár
        setTimeout(() => {
          window.location.href = 'login.html'; // Presmerovanie na prihlasovaciu stránku
        }, 3000);
      } else {
        setNotificationMessage(`Registrácia úspešná, ale chyba pri odosielaní e-mailu: ${scriptResult.error}`);
        console.error('Error sending email:', scriptResult.error);
      }

    } catch (error) {
      console.error('Registration error:', error);
      let errorMessage = 'Nastala chyba pri registrácii.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'E-mailová adresa je už zaregistrovaná.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Heslo je príliš slabé. Použite aspoň 6 znakov.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Neplatný formát e-mailovej adresy.';
      }
      setNotificationMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    step === 1 ?
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
        selectedCountryDialCode: selectedCountryDialCode
      }) :
      React.createElement(Page2Form, {
        formData: formData,
        handleChange: handleChange,
        handlePrev: handlePrev,
        handleSubmit: handleSubmit,
        loading: loading,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification
      })
  );
}

// Render the App component
// Predpokladáme, že 'root' div je už v DOM a ReactDOM je načítaný.
// Tento kód sa spustí, keď je register.js načítaný a preložený Babelom.
if (typeof ReactDOM !== 'undefined' && document.getElementById('root')) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App, null));
  console.log("register.js: React App vykreslená.");
} else {
  console.error("register.js: ReactDOM alebo element 'root' nie je k dispozícii pre vykreslenie React App.");
}
