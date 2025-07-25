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

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  // SVG ikony pre oko (zobraziť heslo) a oko-preškrtnuté (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu oka (viditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu celého oka
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' }),
    // Cesta pre diagonálnu čiaru preškrtnutia
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M4 20 L20 4' }) // Diagonálna čiara
  );

  return React.createElement(
    'div',
    null, // Odstránené 'relative' z tohto divu
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative flex items-center' }, // Pridané 'flex items-center' pre tento kontajner
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        // Zmenené mb-3 na mb-0 a pridaný mt-0 pre input, aby sme lepšie kontrolovali medzery
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10 mb-0 mt-0',
        value: value,
        onChange: onChange,
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          // Upravené triedy pre centrovanie a focus ohraničenie
          // Používame top-1/2 a -translate-y-1/2 pre presné vertikálne centrovanie
          className: 'absolute right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg top-1/2 -translate-y-1/2',
          disabled: disabled,
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    // Zmena <p> na <div> pre description, aby sa predišlo chybe vnorenia <ul> v <p>
    description && React.createElement(
      'div', // Zmenené z 'p' na 'div'
      { className: 'text-gray-600 text-sm mt-2' }, // Zmenené z mt-1 na mt-2 pre väčší odstup
      description
    )
  );
}

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

// CountryCodeModal Component for selecting phone dial code
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, countryCodes, disabled }) {
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const [searchTerm, setSearchTerm] = React.useState(''); // Nový stav pre vyhľadávací termín

  React.useEffect(() => {
    // Reset tempSelectedCode when modal opens or selectedCode changes externally
    if (isOpen) {
      setTempSelectedCode(selectedCode);
      setSearchTerm(''); // Reset search term when modal opens
    }
  }, [isOpen, selectedCode]);

  if (!isOpen) return null;

  // Funkcia na zastavenie šírenia udalosti, aby kliknutie vo vnútri modalu nezatvorilo modal
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  // Funkcia pre tlačidlo "OK"
  const handleConfirm = () => {
    onSelect(tempSelectedCode);
    onClose();
  };

  // Filtrovanie zoznamu krajín na základe vyhľadávacieho termínu
  const filteredCountryCodes = countryCodes.filter(country =>
    country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dialCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return React.createElement(
    'div',
    { 
      className: 'modal', // Používa štýly definované v register.html pre .modal (pre overlay)
      onClick: onClose // Kliknutie na overlay zatvorí modal
    }, 
    React.createElement(
      'div',
      { 
        className: 'modal-content max-w-lg w-full p-6', // Rozšírenie šírky modalu
        onClick: handleContentClick // Kliknutie vo vnútri modalu nezatvorí modal
      }, 
      React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Vyberte predvoľbu krajiny'),
      React.createElement(
        'input',
        {
          type: 'text',
          placeholder: 'Vyhľadať podľa kódu alebo predvoľby...',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value),
          disabled: disabled,
        }
      ),
      React.createElement(
        'div',
        { className: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-2' }, // Mriežka pre tlačidlá, s max výškou a scrollom
        filteredCountryCodes.map((country) =>
          React.createElement(
            'button',
            {
              key: country.code,
              onClick: () => setTempSelectedCode(country.dialCode),
              className: `py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-200 
                          ${tempSelectedCode === country.dialCode 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`,
              disabled: disabled,
            },
            `${country.code} ${country.dialCode}`
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4 mt-6' },
        React.createElement(
          'button',
          {
            onClick: onClose, // Používame priamo onClose prop
            className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'Zatvoriť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleConfirm, // Voláme novú handleConfirm funkciu
            className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'OK'
        )
      )
    )
  );
}


// Main React component for the register.html page
function App() {
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Inicializácia na undefined
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');
  const [registrationSuccess, setRegistrationSuccess] = React.useState(false); // NOVÝ stav pre úspešnú registráciu

  // Page 1 states
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [contactPhoneNumberLocal, setContactPhoneNumberLocal] = React.useState(''); // Len samotné číslo
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Predvolená predvoľba pre SK
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false); // Stav pre modálne okno predvoľby

  // Page 2 states (NEW)
  const [clubName, setClubName] = React.useState('');
  const [ico, setIco] = React.useState('');
  const [dic, setDic] = React.useState('');
  const [icDph, setIcDph] = React.useState('');
  const [street, setStreet] = React.useState('');
  const [houseNumber, setHouseNumber] = React.useState('');
  const [zipCode, setZipCode] = React.useState('');
  const [city, setCity] = React.useState('');
  const [country, setCountry] = React.useState('');

  // Multi-page form state
  const [currentPage, setCurrentPage] = React.useState(1); // Current page of the form

  // States for date and time settings
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // New state for countdown
  const [countdown, setCountdown] = React.useState(null);
  // New state variable to force recalculation of isRegistrationOpen
  const [forceRegistrationCheck, setForceRegistrationCheck] = React.useState(0);
  // New state variable for periodic update of isRegistrationOpen
  const [periodicRefreshKey, setPeriodicRefreshKey] = React.useState(0);

  // States for password visibility
  const [showPasswordReg, setShowPasswordReg] = React.useState(false);
  const [showConfirmPasswordReg, setShowConfirmPasswordReg] = React.useState(false);

  // Calculate registration status as a memoized value
  const isRegistrationOpen = React.useMemo(() => {
    if (!settingsLoaded) return false; // Wait until settings are loaded
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    // Check if dates are valid before comparison
    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    return (
      (isRegStartValid ? now >= regStart : true) && // If regStart is not valid, assume registration has started
      (isRegEndValid ? now <= regEnd : true)        // If regEnd is not valid, assume registration has not ended
    );
  }, [settingsLoaded, registrationStartDate, registrationEndDate, forceRegistrationCheck, periodicRefreshKey]);

  // Function to calculate remaining time for countdown
  const calculateTimeLeft = React.useCallback(() => {
    const now = new Date();
    const startDate = registrationStartDate ? new Date(registrationStartDate) : null;

    // If startDate is not a valid date, or is already in the past, no countdown is needed
    if (!startDate || isNaN(startDate) || now >= startDate) {
        return null; 
    }

    const difference = startDate.getTime() - now.getTime(); // Difference in milliseconds

    if (difference <= 0) {
        return null; // Time has passed
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, [registrationStartDate]);

  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        setError("Firebase SDK nie je načítané. Skontrolujte register.html.");
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
          // Používame globálne __initial_auth_token
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await authInstance.signInWithCustomToken(__initial_auth_token);
          } else {
            // No anonymous sign-in for register.js, user will explicitly register or log in
          }
        } catch (e) {
          console.error("Chyba pri počiatočnom prihlásení Firebase:", e);
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("RegisterApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
        setUser(currentUser);
        setLoading(false); // Auth state checked, stop loading
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("Nepodarilo sa inicializovať Firebase:", e);
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []); // Empty dependency array - runs only once on component mount


  // Effect for loading settings (runs after DB and Auth are initialized)
  React.useEffect(() => {
    const fetchSettings = async () => {
      if (!db || user !== null) { // Wait for DB and user to be explicitly null (not logged in)
        return;
      }
      try {
          const settingsDocRef = db.collection('settings').doc('registration');
          const unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
            } else {
                console.log("Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
            }
            setSettingsLoaded(true);
          }, error => {
            console.error("Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            setError(`Chyba pri načítaní nastavení: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => unsubscribeSettings();
      } catch (e) {
          console.error("Chyba pri nastavovaní onSnapshot pre nastavenia registrácie:", e);
          setError(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db, user]); // Depend on db and user (to ensure user is null before fetching settings)

  // Effect for countdown (runs when registrationStartDate changes)
  React.useEffect(() => {
    let timer;
    const updateCountdown = () => {
        const timeLeft = calculateTimeLeft();
        setCountdown(timeLeft);
        if (timeLeft === null) {
            clearInterval(timer);
            setForceRegistrationCheck(prev => prev + 1);
        }
    };

    if (registrationStartDate && new Date(registrationStartDate) > new Date()) {
        updateCountdown();
        timer = setInterval(updateCountdown, 1000);
    } else {
        setCountdown(null);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate, calculateTimeLeft]);

  // New useEffect for periodic update of isRegistrationOpen
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPeriodicRefreshKey(prev => prev + 1);
    }, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`RegisterApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}, isRegistrationOpen: ${isRegistrationOpen}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden'); // Always hide for logged-in users
        console.log("RegisterApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
          registerLink && registerLink.classList.remove('hidden');
          console.log("RegisterApp: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
          registerLink && registerLink.classList.add('hidden');
          console.log("RegisterApp: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
        }
      }
    }
  }, [user, isRegistrationOpen]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("Chyba pri odhlásení:", e);
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

  const getRecaptchaToken = async (action) => {
    if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) {
      setError("reCAPTCHA API nie je načítané alebo pripravené.");
      return null;
    }
    try {
      const token = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: action });
      return token;
    } catch (e) {
      console.error("Chyba pri získavaní reCAPTCHA tokenu:", e);
      setError(`Chyba reCAPTCHA: ${e.message}`);
      return null;
    }
  };

  const validatePassword = (pwd) => {
    const errors = [];

    if (pwd.length < 10) {
      errors.push("minimálne 10 znakov");
    }
    if (pwd.length > 4096) {
      errors.push("maximálne 4096 znakov");
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push("aspoň jedno veľké písmeno");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("aspoň jedno malé písmeno");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("aspoň jednu číslicu");
    }

    if (errors.length === 0) {
      return null;
    } else {
      return "Heslo musí obsahovať:\n• " + errors.join("\n• ") + ".";
    }
  };

  // Validation for Page 1 fields
  const validatePage1 = () => {
    setError('');
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setError("Prosím, vyplňte všetky povinné polia na tejto stránke.");
      return false;
    }
    if (password !== confirmPassword) {
      setError("Heslá sa nezhodujú. Prosím, skontrolujte ich.");
      return false;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return false;
    }

    // Telefónne číslo validácia len pre bežnú registráciu
    if (!is_admin_register_page) {
      if (!contactPhoneNumberLocal) {
          setError("Prosím, zadajte telefónne číslo kontaktnej osoby.");
          return false;
      }
      // Kontrola, či lokálne číslo obsahuje iba číslice
      if (!/^\d+$/.test(contactPhoneNumberLocal)) {
          setError("Telefónne číslo môže obsahovať iba číslice (bez predvoľby).");
          return false;
      }
    }
    return true;
  };

  // Validation for Page 2 fields
  const validatePage2 = () => {
    setError('');
    if (!clubName) {
      setError("Prosím, zadajte oficiálny názov klubu.");
      return false;
    }

    // Validate at least one of ICO, DIC, ICDPH is filled
    if (!ico && !dic && !icDph) {
      setError("Prosím, zadajte aspoň jedno z polí IČO, DIČ alebo IČ DPH.");
      return false;
    }

    // ICO validation (numbers only)
    if (ico && !/^\d+$/.test(ico)) {
      setError("IČO môže obsahovať iba čísla.");
      return false;
    }

    // DIC validation (numbers only)
    if (dic && !/^\d+$/.test(dic)) {
      setError("DIČ môže obsahovať iba čísla.");
      return false;
    }

    // IC DPH validation (first two chars uppercase letters, then numbers)
    if (icDph) {
      const icDphRegex = /^[A-Z]{2}\d+$/;
      if (!icDphRegex.test(icDph)) {
        setError("IČ DPH musí začať dvoma veľkými písmenami a nasledovať číslice (napr. SK1234567890).");
        return false;
      }
    }

    if (!street || !houseNumber || !zipCode || !city || !country) {
      setError("Prosím, vyplňte všetky polia fakturačnej adresy.");
      return false;
    }

    // PSČ validation (numbers only, format XXXXX)
    if (zipCode && !/^\d{3} \d{2}$/.test(zipCode)) {
      setError("PSČ musí byť vo formáte 123 45 (päť číslic s medzerou po tretej).");
      return false;
    }

    return true;
  };

  const handleNextPage = () => {
    if (currentPage === 1) {
      if (validatePage1()) {
        setCurrentPage(2);
      }
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleRegisterSubmit = async (e, isAdminRegistration = false) => {
    e.preventDefault(); // Prevent default form submission
    
    // Validate current page before final submission
    if (currentPage === 2) {
      if (!validatePage2()) {
        return;
      }
    } else {
        // This should not happen if navigation is controlled, but as a fallback
        setError("Prosím, prejdite na poslednú stránku formulára a skontrolujte údaje.");
        return;
    }

    if (!auth || !db) {
      setError("Firebase Auth alebo Firestore nie je inicializovaný.");
      return;
    }

    const recaptchaToken = await getRecaptchaToken('register');
    if (!recaptchaToken) {
      setError("Overenie reCAPTCHA zlyhalo. Prosím, skúste to znova.");
      return null;
    }
    console.log("reCAPTCHA Token pre registráciu:", recaptchaToken);

    setLoading(true);
    setError('');
    setRegistrationSuccess(false); // Reset success state at the start of submission
    
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      console.log("Firebase Auth: Používateľ vytvorený:", userCredential.user.uid);
      await userCredential.user.updateProfile({ displayName: `${firstName} ${lastName}` });
      console.log("Firebase Auth: Profil používateľa aktualizovaný.");

      let initialUserRole = 'user';
      let initialIsApproved = true;

      if (isAdminRegistration) {
        initialUserRole = 'admin'; // Zmena: pre admin registráciu nastavíme rolu na 'admin'
        initialIsApproved = false; // Zmena: admini musia byť schválení
      }

      // Zostavenie celého telefónneho čísla
      const fullContactPhoneNumber = is_admin_register_page ? '' : `${selectedCountryDialCode}${contactPhoneNumberLocal}`;

      const userDataToSave = {
        uid: userCredential.user.uid,
        email: email,
        firstName: firstName,
        lastName: lastName,
        contactPhoneNumber: fullContactPhoneNumber, // Uložíme celé číslo
        displayName: `${firstName} ${lastName}`,
        role: initialUserRole,
        approved: initialIsApproved,
        registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
        displayNotifications: true,
        passwordLastChanged: firebase.firestore.FieldValue.serverTimestamp(), // Pridané pre sledovanie zmeny hesla
        // Billing details
        billing: {
          clubName: clubName,
          ico: ico,
          dic: dic,
          icDph: icDph,
          address: {
            street: street,
            houseNumber: houseNumber,
            zipCode: zipCode,
            city: city,
            country: country,
          }
        }
      };

      // Logovanie údajov, ktoré sa majú zapísať
      console.log("Údaje, ktoré sa majú zapísať do Firestore:", userDataToSave);

      // Await the main user document save to Firestore
      await db.collection('users').doc(userCredential.user.uid).set(userDataToSave);
      console.log(`Firestore: Používateľ ${email} s počiatočnou rolou '${initialUserRole}' a schválením '${initialIsApproved}' bol uložený.`);

      // Optional: Verify data immediately after saving (for debugging, can be removed in production)
      const docRef = db.collection('users').doc(userCredential.user.uid);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        console.log("Údaje načítané z Firestore po zápise (overenie):", docSnap.data());
      } else {
        console.warn("Firestore: Dokument používateľa sa nenašiel po zápise (overenie).");
      }

      // --- Logika pre ukladanie notifikácie pre administrátorov (tiež awaited) ---
      try {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Používame globálne appId
          let notificationMessage = '';
          const notificationRecipientId = 'all_admins'; 

          if (isAdminRegistration) {
              notificationMessage = `Nový administrátor ${email} sa zaregistroval a čaká na schválenie.`;
          } else {
              notificationMessage = `Nový používateľ ${email} sa zaregistroval.`;
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notifikácia o novej registrácii úspešne uložená do Firestore.");
          }
      } catch (e) {
          console.error("App: Chyba pri ukladaní notifikácie o registrácii:", e);
          // Do not re-throw, allow main registration to proceed even if notification fails
      }
      // --- Koniec logiky pre ukladanie notifikácie ---

      // Odoslanie e-mailu po úspešnom uložení do Firestore
      // Táto operácia nie je awaited, aby neblokovala UI a presmerovanie.
      // Chyby pri odosielaní e-mailu nebudú brániť úspešnej registrácii.
      try {
        const payload = {
          action: 'sendRegistrationEmail',
          email: email,
          password: password, 
          isAdmin: isAdminRegistration, 
          firstName: firstName,
          lastName: lastName,
          contactPhoneNumber: fullContactPhoneNumber, // Pošleme celé číslo
          billing: { 
              clubName: clubName,
              ico: ico,
              dic: dic,
              icDph: icDph,
              address: {
                  street: street,
                  houseNumber: houseNumber,
                  zipCode: zipCode,
                  city: city,
                  country: country,
              }
          }
        };
        console.log("Odosielam dáta na Apps Script (registračný e-mail):", payload);
        fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors', // Dôležité pre obídenie CORS politiky, ak Apps Script nemá správne hlavičky
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }).then(response => {
            console.log("Žiadosť na odoslanie registračného e-mailu odoslaná.");
        }).catch(emailError => {
            console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (fetch error):", emailError);
        });

      } catch (emailError) {
        console.error("Chyba pri odosielaní registračného e-mailu cez Apps Script (synchronná chyba):", emailError);
      }

      // Všetky kritické operácie zápisu dát sú dokončené a overené.
      // Teraz nastavíme správu o úspechu a príznak, potom prejdeme k odhláseniu/presmerovaniu.
      if (isAdminRegistration) {
        setUserNotificationMessage(`Administrátorský účet pre ${email} sa registruje. Na vašu e-mailovú adresu sme odoslali potvrdenie registrácie. Pre úplnú aktiváciu počkajte, prosím, na schválenie účtu iným administrátorom.`);
      } else {
        setUserNotificationMessage(`Ďakujeme za registráciu Vášho klubu na turnaj Slovak Open Handball. Na e-mailovú adresu ${email} sme odoslali potvrdenie registrácie.`);
      }
      setRegistrationSuccess(true); // Označenie úspešnej registrácie
      setLoading(false);

      // Až teraz, a len teraz, vykonáme odhlásenie a presmerovanie
      await auth.signOut(); 
      setUser(null); // Vyčistíme lokálny stav používateľa
      console.log("Firebase Auth: Používateľ odhlásený po registrácii.");
      
      setTimeout(() => {
        console.log("Presmerovanie na login.html...");
        window.location.href = 'login.html'; 
      }, 5000); // Dáme používateľovi čas prečítať si správu o úspechu

    } catch (e) {
      console.error("Chyba pri registrácii (Auth alebo iné):", e); 
      if (e.code === 'auth/email-already-in-use') {
        setError("E-mailová adresa už existuje. Prosím, zvoľte inú.");
      } else if (e.code === 'auth/weak-password') {
        setError("Heslo je príliš slabé. " + validatePassword(password));
      } else if (e.code === 'auth/invalid-email') {
        setError("Neplatný formát e-mailovej adresy.");
      } else {
        setError(`Chyba pri registrácii: ${e.message}`);
      }
      setLoading(false); 
      setUserNotificationMessage(''); // Vyčistíme akúkoľvek čakajúcu správu o úspechu
      setRegistrationSuccess(false); // Zabezpečíme, že príznak úspechu je pri chybe false
    } 
  };

  const currentPath = window.location.pathname.split('/').pop();
  const isRegistrationPage = currentPath === 'register.html' || currentPath === 'admin-register.html';
  const is_admin_register_page = currentPath === 'admin-register.html';

  // Prioritné zobrazenie správy o úspešnej registrácii na registračných stránkach
  if (isRegistrationPage && registrationSuccess) { // Používame nový príznak registrationSuccess
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Registrácia úspešná!'),
          React.createElement(
            'div',
            { className: 'bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
            userNotificationMessage
          ),
          React.createElement('p', { className: 'text-lg text-gray-600' }, 'Presmerovanie na prihlasovaciu stránku...')
        )
      )
    );
  }

  // Ak nie je registrácia s úspešnou správou, potom kontrolujeme ostatné stavy načítania
  if (loading || user === undefined || !settingsLoaded) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  const now = new Date();
  const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
  const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

  // Ak nie je admin registrácia a registrácia nie je otvorená, zobrazte správu
  if (!is_admin_register_page && !isRegistrationOpen) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center font-inter overflow-y-auto' },
      React.createElement(
        'div',
        { className: 'w-full max-w-md mt-20 mb-10 p-4' },
        React.createElement(
          'div',
          { className: 'bg-white p-8 rounded-lg shadow-xl w-full text-center' },
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-4' }, 'Registrácia na turnaj'),
          React.createElement(
            'p',
            { className: 'text-lg text-gray-600' },
            'Registračný formulár nie je prístupný.'
          ),
          regStart && !isNaN(regStart) && now < regStart && (
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'p',
                { className: 'text-md text-gray-500 mt-2' },
                'Registrácia bude možná od:',
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleDateString('sk-SK')),
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleTimeString('sk-SK'))
              ),
              countdown && (
                  React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
              )
            )
          ),
          regEnd && !isNaN(regEnd) && now > regEnd && (
            React.createElement(
              'p',
              { className: 'text-md text-gray-500 mt-2' },
              'Registrácia skončila:',
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
              ' ',
              React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
            )
          )
        )
      )
    );
  }
    
  // Zobrazenie registračného formulára s potenciálnou správou
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-md mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        error && React.createElement(
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          error
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          is_admin_register_page ? "Registrácia administrátora" : "Registrácia na turnaj"
        ),

        // Page 1: Contact Person Details
        currentPage === 1 && React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Údaje kontaktnej osoby'),
          React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' },
                is_admin_register_page ? "Meno" : "Meno kontaktnej osoby"
              ),
              React.createElement('input', {
                type: 'text',
                id: 'reg-first-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: firstName,
                onChange: (e) => setFirstName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje meno",
                autoComplete: "given-name",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' },
                is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby"
              ),
              React.createElement('input', {
                type: 'text',
                id: 'reg-last-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: lastName,
                onChange: (e) => setLastName(e.target.value),
                required: true,
                placeholder: "Zadajte svoje priezvisko",
                autoComplete: "family-name",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            is_admin_register_page ? (
              React.createElement(
                'div',
                null,
                React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa'),
                React.createElement('input', {
                  type: 'email',
                  id: 'reg-email',
                  className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                  value: email,
                  onChange: (e) => setEmail(e.target.value),
                  required: true,
                  placeholder: "Zadajte svoju e-mailovú adresu",
                  autoComplete: "email",
                  disabled: loading || !!userNotificationMessage,
                })
              )
            ) : (
              React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'div',
                  null,
                  React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-phone-number' }, 'Telefónne číslo kontaktnej osoby'),
                  React.createElement(
                    'div',
                    { className: 'flex items-center border border-gray-300 rounded-lg shadow-sm focus-within:border-blue-500 focus-within:shadow-outline transition-all duration-200' }, // Spoločné orámovanie
                    React.createElement(
                      'button', // Zmenené na tlačidlo pre otvorenie modalu
                      {
                        type: 'button',
                        onClick: () => setIsCountryCodeModalOpen(true),
                        className: 'flex-shrink-0 py-2 px-3 text-gray-700 leading-tight focus:outline-none rounded-l-lg hover:bg-gray-100 transition-colors duration-200 flex items-center', // Bez orámovania, pridané flex items-center
                        disabled: loading || !!userNotificationMessage,
                      },
                      React.createElement('span', null, selectedCountryDialCode),
                      React.createElement('svg', { className: 'ml-2 h-4 w-4 text-gray-600 inline-block', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, // Pridané inline-block
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                      )
                    ),
                    React.createElement('input', {
                      type: 'tel',
                      id: 'reg-phone-number',
                      className: 'flex-grow py-2 px-3 text-gray-700 leading-tight focus:outline-none rounded-r-lg', // Bez orámovania
                      value: contactPhoneNumberLocal,
                      onChange: (e) => {
                        const value = e.target.value.replace(/\D/g, ''); // Povoliť iba číslice
                        setContactPhoneNumberLocal(value);
                      },
                      required: true,
                      placeholder: "Zadajte číslo",
                      disabled: loading || !!userNotificationMessage,
                    })
                  )
                ),
                React.createElement(
                  'p',
                  { className: 'text-gray-600 text-sm -mt-2' },
                  'E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.'
                )
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa kontaktnej osoby'),
              React.createElement('input', {
                type: 'email',
                id: 'reg-email',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: email,
                onChange: (e) => setEmail(e.target.value),
                required: true,
                placeholder: "Zadajte svoju e-mailovú adresu",
                autoComplete: "email",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'p',
              { className: 'text-gray-600 text-sm' },
              'Vytvorenie hesla umožní neskorší prístup k registračnému formuláru, v prípade potreby úpravy alebo doplnenia poskytnutých údajov.'
            ),
            React.createElement(PasswordInput, {
              id: 'reg-password',
              label: 'Heslo',
              value: password,
              onChange: (e) => setPassword(e.target.value),
              onCopy: (e) => e.preventDefault(),
              onPaste: (e) => e.preventDefault(),
              onCut: (e) => e.preventDefault(),
              placeholder: "Zvoľte heslo (min. 10 znakov)",
              autoComplete: "new-password",
              showPassword: showPasswordReg,
              toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
              disabled: loading || !!userNotificationMessage,
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
              )
            }),
            React.createElement(PasswordInput, {
              id: 'reg-confirm-password',
              label: 'Potvrďte heslo',
              value: confirmPassword,
              onChange: (e) => setConfirmPassword(e.target.value),
              onCopy: (e) => e.preventDefault(),
              onPaste: (e) => e.preventDefault(),
              onCut: (e) => e.preventDefault(),
              placeholder: "Potvrďte heslo",
              autoComplete: "new-password",
              showPassword: showConfirmPasswordReg,
              toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
              disabled: loading || !!userNotificationMessage,
            }),
            React.createElement(
              'button',
              {
                type: 'button', // Changed to button type
                onClick: handleNextPage,
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
                disabled: loading || !!userNotificationMessage,
              },
              'Ďalej'
            )
          )
        ),

        // Page 2: Billing Details (NEW)
        currentPage === 2 && React.createElement(
          React.Fragment,
          null,
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Fakturačné údaje'),
          React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'club-name' }, 'Oficiálny názov klubu'),
              React.createElement('input', {
                type: 'text',
                id: 'club-name',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: clubName,
                onChange: (e) => setClubName(e.target.value),
                required: true,
                placeholder: "Názov klubu",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'ico' }, 'IČO'),
              React.createElement('input', {
                type: 'text',
                id: 'ico',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: ico,
                onChange: (e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Keep only digits
                  setIco(value);
                },
                placeholder: "Zadajte IČO (iba čísla)",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'dic' }, 'DIČ'),
              React.createElement('input', {
                type: 'text',
                id: 'dic',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: dic,
                onChange: (e) => {
                  const value = e.target.value.replace(/\D/g, ''); // Keep only digits
                  setDic(value);
                },
                placeholder: "Zadajte DIČ (iba čísla)",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'ic-dph' }, 'IČ DPH'),
              React.createElement('input', {
                type: 'text',
                id: 'ic-dph',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: icDph,
                onChange: (e) => {
                  let value = e.target.value.toUpperCase();
                  // Allow only uppercase letters for first two characters, then digits
                  if (value.length > 2) {
                    value = value.substring(0,2).replace(/[^A-Z]/g, '') + value.substring(2).replace(/\D/g, '');
                  } else {
                    value = value.replace(/[^A-Z]/g, '');
                  }
                  setIcDph(value);
                },
                placeholder: "Zadajte IČ DPH (napr. SK1234567890)",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement('p', { className: 'text-gray-600 text-sm mt-2' }, 'Vyplňte aspoň jedno z polí: IČO, DIČ, IČ DPH.'),

            React.createElement('h3', { className: 'text-xl font-bold text-gray-800 mt-6 mb-2' }, 'Fakturačná adresa'),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'street' }, 'Ulica'),
              React.createElement('input', {
                type: 'text',
                id: 'street',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: street,
                onChange: (e) => setStreet(e.target.value),
                required: true,
                placeholder: "Názov ulice",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'house-number' }, 'Popisné číslo'),
              React.createElement('input', {
                type: 'text',
                id: 'house-number',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: houseNumber,
                onChange: (e) => setHouseNumber(e.target.value),
                required: true,
                placeholder: "Popisné číslo",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'zip-code' }, 'PSČ'),
              React.createElement('input', {
                type: 'text',
                id: 'zip-code',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: zipCode,
                onChange: (e) => {
                  let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                  if (value.length > 3) {
                    value = value.substring(0, 3) + ' ' + value.substring(3, 5);
                  }
                  setZipCode(value);
                },
                maxLength: 6, // 3 digits + space + 2 digits
                required: true,
                placeholder: "123 45",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'city' }, 'Mesto'),
              React.createElement('input', {
                type: 'text',
                id: 'city',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: city,
                onChange: (e) => setCity(e.target.value),
                required: true,
                placeholder: "Názov mesta",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              null,
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'country' }, 'Štát'),
              React.createElement('input', {
                type: 'text',
                id: 'country',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: country,
                onChange: (e) => setCountry(e.target.value),
                required: true,
                placeholder: "Názov štátu",
                disabled: loading || !!userNotificationMessage,
              })
            ),
            React.createElement(
              'div',
              { className: 'flex justify-between mt-6' },
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: handlePreviousPage,
                  className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                  disabled: loading || !!userNotificationMessage,
                },
                'Späť'
              ),
              React.createElement(
                'button',
                {
                  type: 'submit', // This button will submit the form
                  onClick: (e) => handleRegisterSubmit(e, is_admin_register_page), // Ensure submit calls the main handler
                  className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
                  disabled: loading || !!userNotificationMessage,
                },
                loading ? (
                  React.createElement(
                    'div',
                    { className: 'flex items-center justify-center' },
                    React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-white', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
                      React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                      React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
                    ),
                    'Registrujem...'
                  )
                ) : 'Registrovať sa'
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
        countryCodes: countryCodes,
        disabled: loading || !!userNotificationMessage,
      })
    )
  );
}

// Render the React application after the App component is defined
// This ensures that App is available when ReactDOM.createRoot is called.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App, null));
