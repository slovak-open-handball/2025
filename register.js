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
const countries = [
  { name: 'Slovensko', code: 'SK', dial_code: '+421' },
  { name: 'Česká republika', code: 'CZ', dial_code: '+420' },
  { name: 'Nemecko', code: 'DE', dial_code: '+49' },
  { name: 'Rakúsko', code: 'AT', dial_code: '+43' },
  { name: 'Maďarsko', code: 'HU', dial_code: '+36' },
  { name: 'Poľsko', code: 'PL', dial_code: '+48' },
  { name: 'Ukrajina', code: 'UA', dial_code: '+380' },
  { name: 'Spojené kráľovstvo', code: 'GB', dial_code: '+44' },
  { name: 'Spojené štáty', code: 'US', dial_code: '+1' },
  { name: 'Kanada', code: 'CA', dial_code: '+1' },
  { name: 'Francúzsko', code: 'FR', dial_code: '+33' },
  { name: 'Taliansko', code: 'IT', dial_code: '+39' },
  { name: 'Španielsko', code: 'ES', dial_code: '+34' },
  { name: 'Švajčiarsko', code: 'CH', dial_code: '+41' },
  { name: 'Belgicko', code: 'BE', dial_code: '+32' },
  { name: 'Holandsko', code: 'NL', dial_code: '+31' },
  { name: 'Švédsko', code: 'SE', dial_code: '+46' },
  { name: 'Nórsko', code: 'NO', dial_code: '+47' },
  { name: 'Dánsko', code: 'DK', dial_code: '+45' },
  { name: 'Fínsko', code: 'FI', dial_code: '+358' },
  { name: 'Írsko', code: 'IE', dial_code: '+353' },
  { name: 'Portugalsko', code: 'PT', dial_code: '+351' },
  { name: 'Grécko', code: 'GR', dial_code: '+30' },
  { name: 'Turecko', code: 'TR', dial_code: '+90' },
  { name: 'Rusko', code: 'RU', dial_code: '+7' },
  { name: 'Čína', code: 'CN', dial_code: '+86' },
  { name: 'India', code: 'IN', dial_code: '+91' },
  { name: 'Austrália', code: 'AU', dial_code: '+61' },
  { name: 'Nový Zéland', code: 'NZ', dial_code: '+64' },
  { name: 'Japonsko', code: 'JP', dial_code: '+81' },
  { name: 'Južná Kórea', code: 'KR', dial_code: '+82' },
  { name: 'Brazília', code: 'BR', dial_code: '+55' },
  { name: 'Mexiko', code: 'MX', dial_code: '+52' },
  { name: 'Argentína', code: 'AR', dial_code: '+54' },
  { name: 'Južná Afrika', code: 'ZA', dial_code: '+27' },
].sort((a, b) => a.name.localeCompare(b.name)); // Zoradenie podľa názvu krajiny

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

// CountryCodeModal Component for selecting phone dial code
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode }) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dial_code.includes(searchTerm)
  );

  if (!isOpen) return null;

  return React.createElement(
    'div',
    {
      className: 'modal',
      onClick: onClose // Close modal when clicking outside content
    },
    React.createElement(
      'div',
      {
        className: 'modal-content',
        onClick: (e) => e.stopPropagation() // Prevent closing when clicking inside content
      },
      React.createElement(
        'h3',
        { className: 'text-xl font-semibold mb-4 text-center' },
        'Vyberte predvoľbu krajiny'
      ),
      React.createElement(
        'input',
        {
          type: 'text',
          placeholder: 'Hľadať krajinu alebo predvoľbu...',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value)
        }
      ),
      React.createElement(
        'div',
        { className: 'max-h-80 overflow-y-auto border border-gray-300 rounded-lg p-2' },
        filteredCountries.map((country) =>
          React.createElement(
            'div',
            {
              key: country.code,
              className: `p-2 cursor-pointer hover:bg-blue-100 rounded-md flex justify-between items-center ${selectedCode === country.dial_code ? 'bg-blue-200 font-semibold' : ''}`,
              onClick: () => {
                onSelect(country.dial_code);
                onClose(); // Use onClose prop here
              }
            },
            React.createElement('span', null, country.name),
            React.createElement('span', { className: 'text-gray-600' }, country.dial_code)
          )
        )
      ),
      React.createElement(
        'button',
        {
          className: 'mt-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full',
          onClick: onClose // Use onClose prop here
        },
        'Zavrieť'
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
              className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-l-lg border border-r-0 border-gray-300 focus:outline-none focus:shadow-outline transition-colors duration-200',
              onClick: () => setIsCountryCodeModalOpen(true), // Otvorí modálne okno
              tabIndex: 4 // Tab index pre tlačidlo predvoľby
            },
            selectedCountryDialCode || '+XXX' // Zobrazí vybranú predvoľbu
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
