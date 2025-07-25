// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> register.html a sú prístupné globálne.
// Odstránené opakované deklarácie.

const RECAPTCHA_SITE_KEY = "6LdJbn8rAAAAAO4C50qXTWva6ePzDlOfYwBDEDwa";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
  { code: 'AF', dialCode: '+93' }, { code: 'AG', dialCode: '+1‑268' }, { code: 'AI', dialCode: '+1‑264' },
  { code: 'AL', dialCode: '+355' }, { code: 'AM', dialCode: '+374' }, { code: 'AO', dialCode: '+244' },
  { code: 'AQ', dialCode: '+672' }, { code: 'AR', dialCode: '+54' }, { code: 'AS', dialCode: '+1‑684' },
  { code: 'AT', dialCode: '+43' }, { code: 'AU', dialCode: '+61' }, { code: 'AW', dialCode: '+297' },
  { code: 'AX', dialCode: '+358' }, { code: 'AZ', dialCode: '+994' }, { code: 'BA', dialCode: '+387' },
  { code: 'BB', dialCode: '+1‑246' }, { code: 'BD', dialCode: '+880' }, { code: 'BE', dialCode: '+32' },
  { code: 'BF', dialCode: '+226' }, { code: 'BG', dialCode: '+359' }, { code: 'BH', dialCode: '+973' },
  { code: 'BI', dialCode: '+257' }, { code: 'BJ', dialCode: '+229' }, { code: 'BL', dialCode: '+590' },
  { code: 'BM', dialCode: '+1‑441' }, { code: 'BN', dialCode: '+673' }, { code: 'BO', dialCode: '+591' },
  { code: 'BQ', dialCode: '+599' }, { code: 'BR', dialCode: '+55' }, { code: 'BS', dialCode: '+1‑242' },
  { code: 'BT', dialCode: '+975' }, { code: 'BW', dialCode: '+267' }, { code: 'BY', dialCode: '+375' },
  { code: 'BZ', dialCode: '+501' }, { code: 'CA', dialCode: '+1' }, { code: 'CC', dialCode: '+61' },
  { code: 'CD', dialCode: '+243' }, { code: 'CF', dialCode: '+236' }, { code: 'CG', dialCode: '+242' },
  { code: 'CH', dialCode: '+41' }, { code: 'CI', dialCode: '+225' }, { code: 'CK', dialCode: '+682' },
  { code: 'CL', dialCode: '+56' }, { code: 'CM', dialCode: '+237' }, { code: 'CN', dialCode: '+86' },
  { code: 'CO', dialCode: '+57' }, { code: 'CR', dialCode: '+506' }, { code: 'CU', dialCode: '+53' },
  { code: 'CV', dialCode: '+238' }, { code: 'CW', dialCode: '+599' }, { code: 'CX', dialCode: '+61' },
  { code: 'CY', dialCode: '+357' }, { code: 'CZ', dialCode: '+420' }, { code: 'DE', dialCode: '+49' },
  { code: 'DJ', dialCode: '+253' }, { code: 'DK', dialCode: '+45' }, { code: 'DM', dialCode: '+1‑767' },
  { code: 'DO', dialCode: '+1‑809' }, { code: 'DZ', dialCode: '+213' }, { code: 'EC', dialCode: '+593' },
  { code: 'EE', dialCode: '+372' }, { code: 'EG', dialCode: '+20' }, { code: 'EH', dialCode: '+212' },
  { code: 'ER', dialCode: '+291' }, { code: 'ES', dialCode: '+34' }, { code: 'ET', dialCode: '+251' },
  { code: 'FI', dialCode: '+358' }, { code: 'FJ', dialCode: '+679' }, { code: 'FK', dialCode: '+500' },
  { code: 'FM', dialCode: '+691' }, { code: 'FO', dialCode: '+298' }, { code: 'FR', dialCode: '+33' },
  { code: 'GA', dialCode: '+241' }, { code: 'GB', dialCode: '+44' }, { code: 'GD', dialCode: '+1‑473' },
  { code: 'GE', dialCode: '+995' }, { code: 'GF', dialCode: '+594' }, { code: 'GG', dialCode: '+44' },
  { code: 'GH', dialCode: '+233' }, { code: 'GI', dialCode: '+350' }, { code: 'GL', dialCode: '+299' },
  { code: 'GM', dialCode: '+220' }, { code: 'GN', dialCode: '+224' }, { code: 'GP', dialCode: '+590' },
  { code: 'GQ', dialCode: '+240' }, { code: 'GR', dialCode: '+30' }, { code: 'GT', dialCode: '+502' },
  { code: 'GU', dialCode: '+1‑671' }, { code: 'GW', dialCode: '+245' }, { code: 'GY', dialCode: '+592' },
  { code: 'HK', dialCode: '+852' }, { code: 'HN', dialCode: '+504' }, { code: 'HR', dialCode: '+385' },
  { code: 'HT', dialCode: '+509' }, { code: 'HU', dialCode: '+36' }, { code: 'ID', dialCode: '+62' },
  { code: 'IE', dialCode: '+353' }, { code: 'IL', dialCode: '+972' }, { code: 'IM', dialCode: '+44' },
  { code: 'IN', dialCode: '+91' }, { code: 'IO', dialCode: '+246' }, { code: 'IQ', dialCode: '+964' },
  { code: 'IR', dialCode: '+98' }, { code: 'IS', dialCode: '+354' }, { code: 'IT', dialCode: '+39' },
  { code: 'JE', dialCode: '+44' }, { code: 'JM', dialCode: '+1‑876' }, { code: 'JO', dialCode: '+962' },
  { code: 'JP', dialCode: '+81' }, { code: 'KE', dialCode: '+254' }, { code: 'KG', dialCode: '+996' },
  { code: 'KH', dialCode: '+855' }, { code: 'KI', dialCode: '+686' }, { code: 'KM', dialCode: '+269' },
  { code: 'KN', dialCode: '+1‑869' }, { code: 'KP', dialCode: '+850' }, { code: 'KR', dialCode: '+82' },
  { code: 'KW', dialCode: '+965' }, { code: 'KY', dialCode: '+1‑345' }, { code: 'KZ', dialCode: '+7' },
  { code: 'LA', dialCode: '+856' }, { code: 'LB', dialCode: '+961' }, { code: 'LC', dialCode: '+1‑758' },
  { code: 'LI', dialCode: '+423' }, { code: 'LK', dialCode: '+94' }, { code: 'LR', dialCode: '+231' },
  { code: 'LS', dialCode: '+266' }, { code: 'LT', dialCode: '+370' }, { code: 'LU', dialCode: '+352' },
  { code: 'LV', dialCode: '+371' }, { code: 'LY', dialCode: '+218' }, { code: 'MA', dialCode: '+212' },
  { code: 'MC', dialCode: '+377' }, { code: 'MD', dialCode: '+373' }, { code: 'ME', dialCode: '+382' },
  { code: 'MF', dialCode: '+590' }, { code: 'MG', dialCode: '+261' }, { code: 'MH', dialCode: '+692' },
  { code: 'MK', dialCode: '+389' }, { code: 'ML', dialCode: '+223' }, { code: 'MM', dialCode: '+95' },
  { code: 'MN', dialCode: '+976' }, { code: 'MO', dialCode: '+853' }, { code: 'MP', dialCode: '+1‑670' },
  { code: 'MQ', dialCode: '+596' }, { code: 'MR', dialCode: '+222' }, { code: 'MS', dialCode: '+1‑664' },
  { code: 'MT', dialCode: '+356' }, { code: 'MU', dialCode: '+230' }, { code: 'MV', dialCode: '+960' },
  { code: 'MW', dialCode: '+265' }, { code: 'MX', dialCode: '+52' }, { code: 'MY', dialCode: '+60' },
  { code: 'MZ', dialCode: '+258' }, { code: 'NA', dialCode: '+264' }, { code: 'NC', dialCode: '+687' },
  { code: 'NE', dialCode: '+227' }, { code: 'NF', dialCode: '+672' }, { code: 'NG', dialCode: '+234' },
  { code: 'NI', dialCode: '+505' }, { code: 'NL', dialCode: '+31' }, { code: 'NO', dialCode: '+47' },
  { code: 'NP', dialCode: '+977' }, { code: 'NR', dialCode: '+674' }, { code: 'NU', dialCode: '+683' },
  { code: 'NZ', dialCode: '+64' }, { code: 'OM', dialCode: '+968' }, { code: 'PA', dialCode: '+507' },
  { code: 'PE', dialCode: '+51' }, { code: 'PF', dialCode: '+689' }, { code: 'PG', dialCode: '+675' },
  { code: 'PH', dialCode: '+63' }, { code: 'PK', dialCode: '+92' }, { code: 'PL', dialCode: '+48' },
  { code: 'PM', dialCode: '+508' }, { code: 'PR', dialCode: '+1‑787' }, { code: 'PS', dialCode: '+970' },
  { code: 'PT', dialCode: '+351' }, { code: 'PW', dialCode: '+680' }, { code: 'PY', dialCode: '+595' },
  { code: 'QA', dialCode: '+974' }, { code: 'RE', dialCode: '+262' }, { code: 'RO', dialCode: '+40' },
  { code: 'RS', dialCode: '+381' }, { code: 'RU', dialCode: '+7' }, { code: 'RW', dialCode: '+250' },
  { code: 'SA', dialCode: '+966' }, { code: 'SB', dialCode: '+677' }, { code: 'SC', dialCode: '+248' },
  { code: 'SD', dialCode: '+249' }, { code: 'SE', dialCode: '+46' }, { code: 'SG', dialCode: '+65' },
  { code: 'SH', dialCode: '+290' }, { code: 'SI', dialCode: '+386' }, { code: 'SJ', dialCode: '+47' },
  { code: 'SK', dialCode: '+421' }, { code: 'SL', dialCode: '+232' }, { code: 'SM', dialCode: '+378' },
  { code: 'SN', dialCode: '+221' }, { code: 'SO', dialCode: '+252' }, { code: 'SR', dialCode: '+597' },
  { code: 'SS', dialCode: '+211' }, { code: 'ST', dialCode: '+239' }, { code: 'SV', dialCode: '+503' },
  { code: 'SX', dialCode: '+1‑721' }, { code: 'SY', dialCode: '+963' }, { code: 'SZ', dialCode: '+268' },
  { code: 'TC', dialCode: '+1‑649' }, { code: 'TD', dialCode: '+235' }, { code: 'TG', dialCode: '+228' },
  { code: 'TH', dialCode: '+66' }, { code: 'TJ', dialCode: '+992' }, { code: 'TK', dialCode: '+690' },
  { code: 'TL', dialCode: '+670' }, { code: 'TM', dialCode: '+993' }, { code: 'TN', dialCode: '+216' },
  { code: 'TO', dialCode: '+676' }, { code: 'TR', dialCode: '+90' }, { code: 'TT', dialCode: '+1‑868' },
  { code: 'TV', dialCode: '+688' }, { code: 'TW', dialCode: '+886' }, { code: 'TZ', dialCode: '+255' },
  { code: 'UA', dialCode: '+380' }, { code: 'UG', dialCode: '+256' }, { code: 'US', dialCode: '+1' },
  { code: 'UY', dialCode: '+598' }, { code: 'UZ', dialCode: '+998' }, { code: 'VA', dialCode: '+379' },
  { code: 'VC', dialCode: '+1‑784' }, { code: 'VE', dialCode: '+58' }, { code: 'VG', dialCode: '+1‑284' },
  { code: 'VI', dialCode: '+1‑340' }, { code: 'VN', dialCode: '+84' }, { code: 'VU', dialCode: '+678' },
  { code: 'WF', dialCode: '+681' }, { code: 'WS', dialCode: '+685' }, { code: 'YE', dialCode: '+967' },
  { code: 'YT', dialCode: '+262' }, { code: 'ZA', dialCode: '+27' }, { code: 'ZM', dialCode: '+260' },
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

  return React.createElement(
    'div',
    {
      className: `fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg transition-transform transform ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`,
      style: { zIndex: 1000 }
    },
    React.createElement('p', { className: 'font-semibold' }, message)
  );
}

// PasswordInput Component for password fields with visibility toggle (converted to React.createElement)
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description, tabIndex }) {
  // SVG icons for eye (show password) and eye-off (hide password)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu oka (viditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    // Cesta pre ikonu preškrtnutého oka (neviditeľné)
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 .96-3.134 3.79-5.63 7.22-7.05m.582 2.582a3 3 0 114.243 4.243M9.879 10.121A3 3 0 1112 13.879M16.002 8.998a10.05 10.05 0 014.24 2.049m-4.24 2.049a10.05 10.05 0 01-4.24 2.049M21 21l-1.5-1.5M3 3l1.5 1.5' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
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
        tabIndex: tabIndex // Pridaný tabIndex
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          tabIndex: -1, // Aby nebolo súčasťou tabulátorovej navigácie
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    description && React.createElement('p', { className: 'text-gray-600 text-xs italic mt-1' }, description)
  );
}

// CountryCodeModal Component for selecting phone dial code
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, disabled }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedCode(selectedCode);
    }
  }, [isOpen, selectedCode]);

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

  const handleConfirm = () => {
    onSelect(tempSelectedCode);
    onClose();
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
        { className: 'grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2' },
        filteredCountries.map((country) =>
          React.createElement(
            'button',
            {
              key: country.code,
              className: `p-2 text-sm rounded-lg border transition-colors duration-200
                          ${tempSelectedCode === country.dialCode ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-100 hover:bg-blue-200 text-gray-800 border-gray-300'}`,
              onClick: () => {
                setTempSelectedCode(country.dialCode);
              },
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
            onClick: onClose,
            className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'Zatvoriť'
        ),
        React.createElement(
          'button',
          {
            onClick: handleConfirm,
            className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'OK'
        )
      )
    )
  );
}

// Page1Form Component
function Page1Form({ formData, handleChange, handleNext, loading, notificationMessage, closeNotification, isCountryCodeModalOpen, setIsCountryCodeModalOpen, setSelectedCountryDialCode, selectedCountryDialCode, PasswordInput, NotificationModal, isRegistrationOpen }) {
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

    // Podmienené zobrazenie formulára alebo správy o uzavretej registrácii
    isRegistrationOpen === false ? (
      React.createElement(
        'div',
        { className: 'text-center text-red-600 font-semibold text-lg py-8' },
        notificationMessage || 'Registrácia je momentálne uzavretá.'
      )
    ) : isRegistrationOpen === null ? ( // Loading state
      React.createElement(
        'div',
        { className: 'flex items-center justify-center py-8' },
        React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' },
          React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
          React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
        ),
        'Načítavam stav registrácie...'
      )
    ) : (
      React.createElement(
        'form',
        { onSubmit: handleNext, className: 'space-y-4' },
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno kontaktnej osoby'),
          React.createElement('input', {
            type: 'text',
            id: 'firstName',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.firstName,
            onChange: handleChange,
            required: true,
            placeholder: 'Zadajte vaše meno',
            tabIndex: 1,
            disabled: loading || !isRegistrationOpen
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko kontaktnej osoby'),
          React.createElement('input', {
            type: 'text',
            id: 'lastName',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.lastName,
            onChange: handleChange,
            required: true,
            placeholder: 'Zadajte vaše priezvisko',
            tabIndex: 2,
            disabled: loading || !isRegistrationOpen
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 'E-mailová adresa kontaktnej osoby'),
          React.createElement('input', {
            type: 'email',
            id: 'email',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.email,
            onChange: handleChange,
            required: true,
            placeholder: 'Zadajte svoju e-mailovú adresu',
            autoComplete: 'email',
            tabIndex: 3,
            disabled: loading || !isRegistrationOpen
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
                className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-l-lg border border-r-0 border-gray-300 focus:outline-none focus:shadow-outline transition-colors duration-200 flex-shrink-0 flex items-center',
                onClick: () => setIsCountryCodeModalOpen(true),
                tabIndex: 4,
                disabled: loading || !isRegistrationOpen
              },
              selectedCountryDialCode || '+XXX',
              ChevronDown
            ),
            React.createElement('input', {
              type: 'tel',
              id: 'contactPhoneNumber',
              className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
              value: formData.contactPhoneNumber,
              onChange: handleChange,
              required: true,
              placeholder: 'Zadajte telefónne číslo',
              tabIndex: 5,
              disabled: loading || !isRegistrationOpen
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
          tabIndex: 6,
          disabled: loading || !isRegistrationOpen
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
          tabIndex: 7,
          disabled: loading || !isRegistrationOpen
        }),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
            disabled: loading || !isRegistrationOpen,
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
      )
    ),
    React.createElement(CountryCodeModal, {
      isOpen: isCountryCodeModalOpen,
      onClose: () => setIsCountryCodeModalOpen(false),
      onSelect: setSelectedCountryDialCode,
      selectedCode: selectedCountryDialCode,
      disabled: loading || !isRegistrationOpen,
    })
  );
}

// Page2Form Component (predpokladáme, že existuje)
function Page2Form({ formData, handleChange, handlePrev, handleSubmit, loading, notificationMessage, closeNotification, showPasswordRegister, toggleShowPasswordRegister, recaptchaRef, userRole, handleRoleChange, NotificationModal }) {
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
      { onSubmit: handleSubmit, className: 'space-y-4' },
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'birthDate' }, 'Dátum narodenia'),
        React.createElement('input', {
          type: 'date',
          id: 'birthDate',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.birthDate,
          onChange: handleChange,
          required: true,
          tabIndex: 9,
          disabled: loading
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'gender' }, 'Pohlavie'),
        React.createElement(
          'select',
          {
            id: 'gender',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.gender,
            onChange: handleChange,
            required: true,
            tabIndex: 10,
            disabled: loading
          },
          React.createElement('option', { value: '' }, 'Vyberte pohlavie'),
          React.createElement('option', { value: 'Muž' }, 'Muž'),
          React.createElement('option', { value: 'Žena' }, 'Žena'),
          React.createElement('option', { value: 'Iné' }, 'Iné')
        )
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'country' }, 'Krajina'),
        React.createElement('input', {
          type: 'text',
          id: 'country',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.country,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte krajinu',
          tabIndex: 11,
          disabled: loading
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
          value: formData.city,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte mesto',
          tabIndex: 12,
          disabled: loading
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'postalCode' }, 'PSČ'),
        React.createElement('input', {
          type: 'text',
          id: 'postalCode',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.postalCode,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte PSČ',
          tabIndex: 13,
          disabled: loading
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'street' }, 'Ulica a číslo domu'),
        React.createElement('input', {
          type: 'text',
          id: 'street',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: formData.street,
          onChange: handleChange,
          required: true,
          placeholder: 'Zadajte ulicu a číslo domu',
          tabIndex: 14,
          disabled: loading
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'role' }, 'Úloha'),
        React.createElement(
          'select',
          {
            id: 'role',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: userRole,
            onChange: handleRoleChange,
            required: true,
            tabIndex: 15,
            disabled: loading
          },
          React.createElement('option', { value: '' }, 'Vyberte úlohu'),
          React.createElement('option', { value: 'player' }, 'Hráč'),
          React.createElement('option', { value: 'coach' }, 'Tréner'),
          React.createElement('option', { value: 'referee' }, 'Rozhodca'),
          React.createElement('option', { value: 'user' }, 'Len používateľ')
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
            tabIndex: 16
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: loading,
            tabIndex: 17
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

// Main App component
function App() {
  const [page, setPage] = React.useState(1);
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    contactPhoneNumber: '',
    password: '',
    confirmPassword: '',
    birthDate: '',
    gender: '',
    country: '',
    city: '',
    postalCode: '',
    street: '',
  });
  const [userRole, setUserRole] = React.useState('user'); // Default role
  const [loading, setLoading] = React.useState(false);
  const [notificationMessage, setNotificationMessage] = React.useState('');
  const [showNotification, setShowNotification] = React.useState(false);
  const [showPasswordRegister, setShowPasswordRegister] = React.useState(false);
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Default to Slovakia

  // Firebase state
  const [db, setDb] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [isAuthReady, setIsAuthReady] = React.useState(false); // To ensure auth is ready before Firestore ops
  const [isRegistrationOpen, setIsRegistrationOpen] = React.useState(null); // null for loading, true/false after check

  // Recaptcha ref
  const recaptchaRef = React.useRef(null);

  // Initialize Firebase and Auth
  React.useEffect(() => {
    try {
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestoreDb);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
        // No need to set user state here as it's not directly used for display in register.js
        // Just ensure authentication is handled for Firestore rules.
        if (!currentUser && typeof __initial_auth_token !== 'undefined') {
          try {
            await signInWithCustomToken(firebaseAuth, __initial_auth_token);
          } catch (error) {
            console.error("Chyba pri prihlásení s vlastným tokenom:", error);
            try {
              await signInAnonymously(firebaseAuth);
            } catch (anonError) {
              console.error("Chyba pri anonymnom prihlásení:", anonError);
            }
          }
        } else if (!currentUser) {
          try {
            await signInAnonymously(firebaseAuth);
          } catch (anonError) {
            console.error("Chyba pri anonymnom prihlásení:", anonError);
          }
        }
        setIsAuthReady(true); // Auth state is now known
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Chyba pri inicializácii Firebase:", error);
      setNotificationMessage('Chyba pri inicializácii aplikácie.');
      setShowNotification(true);
    }
  }, []); // Run once on mount

  // Fetch and listen for registration status from Firestore
  React.useEffect(() => {
    if (!db || !isAuthReady) {
      return; // Wait for Firebase to be initialized and auth state to be ready
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const docRef = doc(db, `artifacts/${appId}/public/data/tournamentSettings/registration`);

    // Set up a real-time listener for registration settings
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      const now = new Date(); // Current local time
      let isOpen = true;
      let msg = '';

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ensure dates are converted from Firestore Timestamp to JS Date objects
        const registrationStartDate = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
        const registrationEndDate = data.registrationEndDate ? data.registrationEndDate.toDate() : null;

        if (registrationStartDate && now < registrationStartDate) {
          isOpen = false;
          msg = 'Registrácia ešte nezačala.';
        } else if (registrationEndDate && now > registrationEndDate) {
          isOpen = false;
          msg = 'Registrácia je momentálne uzavretá.';
        }
      } else {
        // If settings document doesn't exist, assume registration is open by default
        isOpen = true;
        msg = 'Nastavenia registrácie neboli nájdené. Registrácia je predvolene otvorená.';
        console.warn("Nastavenia registrácie neboli nájdené vo Firestore. Predvolene otvorená registrácia.");
      }

      setIsRegistrationOpen(isOpen);
      setNotificationMessage(msg);
      setShowNotification(msg !== ''); // Show notification only if there's a message
    }, (error) => {
      console.error("Chyba pri počúvaní zmien stavu registrácie:", error);
      setNotificationMessage('Chyba pri aktualizácii stavu registrácie v reálnom čase.');
      setShowNotification(true);
      setIsRegistrationOpen(true); // Fallback to open if error
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [db, isAuthReady]); // Depend on db and isAuthReady

  const closeNotification = () => {
    setShowNotification(false);
    setNotificationMessage('');
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleRoleChange = (e) => {
    setUserRole(e.target.value);
  };

  const handleNext = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);

    // Client-side validation for Page 1
    if (formData.password !== formData.confirmPassword) {
      setNotificationMessage('Heslá sa nezhodujú.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setNotificationMessage('Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    // Verify reCAPTCHA
    const recaptchaToken = await recaptchaRef.current.executeAsync();
    recaptchaRef.current.reset(); // Reset reCAPTCHA after execution

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verifyRecaptcha',
          recaptchaToken: recaptchaToken,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPage(2);
      } else {
        setNotificationMessage('reCAPTCHA overenie zlyhalo. Skúste to prosím znova.');
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Chyba pri overovaní reCAPTCHA:', error);
      setNotificationMessage('Chyba pri overovaní reCAPTCHA. Skúste to prosím neskôr.');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = () => {
    setPage(1);
    setNotificationMessage('');
    setShowNotification(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNotificationMessage('');
    setShowNotification(false);

    // Validate birth date (must be at least 18 years old)
    const birthDate = new Date(formData.birthDate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setNotificationMessage('Musíte mať aspoň 18 rokov pre registráciu.');
      setShowNotification(true);
      setLoading(false);
      return;
    }

    const fullPhoneNumber = `${selectedCountryDialCode}${formData.contactPhoneNumber}`;

    try {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'registerUser',
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          contactPhoneNumber: fullPhoneNumber,
          password: formData.password,
          birthDate: formData.birthDate, // YYYY-MM-DD format
          gender: formData.gender,
          country: formData.country,
          city: formData.city,
          postalCode: formData.postalCode,
          street: formData.street,
          role: userRole,
          registrationDate: formatToDatetimeLocal(new Date()),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setNotificationMessage('Registrácia úspešná! Môžete sa prihlásiť.');
        setShowNotification(true);
        // Clear form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          contactPhoneNumber: '',
          password: '',
          confirmPassword: '',
          birthDate: '',
          gender: '',
          country: '',
          city: '',
          postalCode: '',
          street: '',
        });
        setUserRole('user');
        setPage(1); // Go back to page 1
        // Redirect to login page after a short delay
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 3000);
      } else {
        setNotificationMessage(result.message || 'Registrácia zlyhala. Skúste to prosím znova.');
        setShowNotification(true);
      }
    } catch (error) {
      console.error('Chyba pri registrácii:', error);
      setNotificationMessage('Chyba pri registrácii. Skúste to prosím neskôr.');
      setShowNotification(true);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-gray-100 p-4' },
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),
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
        PasswordInput: PasswordInput,
        NotificationModal: NotificationModal,
        isRegistrationOpen: isRegistrationOpen, // Pass registration status
      }) :
      React.createElement(Page2Form, {
        formData: formData,
        handleChange: handleChange,
        handlePrev: handlePrev,
        handleSubmit: handleSubmit,
        loading: loading,
        notificationMessage: notificationMessage,
        closeNotification: closeNotification,
        showPasswordRegister: showPasswordRegister,
        toggleShowPasswordRegister: () => setShowPasswordRegister(!showPasswordRegister),
        recaptchaRef: recaptchaRef,
        userRole: userRole,
        handleRoleChange: handleRoleChange,
        NotificationModal: NotificationModal,
      }),
    // reCAPTCHA script - ensure it's loaded once and available globally
    React.createElement('script', { src: `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`, async: true, defer: true }),
    React.createElement('div', { id: 'recaptcha-badge', className: 'g-recaptcha', 'data-sitekey': RECAPTCHA_SITE_KEY, 'data-size': 'invisible', 'data-callback': 'onRecaptchaSuccess', 'data-badge': 'bottomleft' })
  );
}

// Ensure App component is rendered
ReactDOM.render(React.createElement(App, null), document.getElementById('root'));
