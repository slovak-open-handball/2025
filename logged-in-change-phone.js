// logged-in-change-phone.js
// Tento súbor obsahuje React komponent pre zmenu telefónneho čísla prihláseného používateľa.
// Predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-change-phone.html.

// Komponent NotificationModal pre zobrazovanie dočasných správ
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
    bgColorClass = 'bg-[#3A8D41]'; // Green
  } else if (type === 'error') {
    bgColorClass = 'bg-red-600'; // Red
  } else {
    bgColorClass = 'bg-blue-500'; // Default blue for info
  }

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
        className: `${bgColorClass} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
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
].sort((a, b) => a.code.localeCompare(b.code)); // Sort by country code

// CountryCodeModal Component
function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, disabled }) { // Added disabled prop
  const [searchTerm, setSearchTerm] = React.useState('');
  // New state for temporarily selected dial code
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const modalRef = React.useRef(null);

  React.useEffect(() => {
    // Initialize tempSelectedCode with the currently selected dial code when the modal opens
    if (isOpen) {
      setTempSelectedCode(selectedCode);
    }
  }, [isOpen, selectedCode]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose(); // Close without saving if clicked outside
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

  // Function for OK button - applies the temporarily selected dial code and closes the modal
  const handleConfirm = () => {
    onSelect(tempSelectedCode); // Apply temporary dial code
    onClose(); // Close modal
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
        { className: 'grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2' }, // Changed to grid-cols-4 and border removed
        filteredCountries.map((country) =>
          React.createElement(
            'button', 
            {
              key: country.code,
              // Compare with tempSelectedCode for visual selection indication
              className: `p-2 text-sm rounded-lg border transition-colors duration-200 
                          ${tempSelectedCode === country.dialCode ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-100 hover:bg-blue-200 text-gray-800 border-gray-300'}`, 
              onClick: () => {
                setTempSelectedCode(country.dialCode); // Set temporary dial code
              },
              disabled: disabled, // Buttons are disabled if the modal is disabled
            },
            `${country.code} ${country.dialCode}` 
          )
        )
      ),
      React.createElement(
        'div',
        { className: 'flex justify-end space-x-4 mt-6' }, // OK and Close buttons, with mt-6
        React.createElement(
          'button',
          {
            onClick: onClose, // Use onClose prop directly, discards changes
            className: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'Zatvoriť' // Changed button text
        ),
        React.createElement(
          'button',
          {
            onClick: handleConfirm, // Call handleConfirm, which applies changes and closes
            className: 'bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200',
            disabled: disabled,
          },
          'OK'
        )
      )
    )
  );
}

// Main React component for the logged-in-change-phone.html page
function ChangePhoneApp() {
  // NEW: Get references to Firebase services directly
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NEW: Local state for the current user and their profile data
  // These states will be updated by the local onAuthStateChanged and onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Initialize with current user
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading for data in ChangePhoneApp
  const [error, setError] = React.useState('');
  // Retained: userNotificationMessage for local notifications
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - These states will be updated from userProfileData
  const [contactPhoneNumber, setContactPhoneNumber] = React.useState('');
  // States for country code selection
  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = React.useState(false);
  const [selectedCountryDialCode, setSelectedCountryDialCode] = React.useState('+421'); // Default to Slovakia

  // NEW: State for data editing deadline
  const [dataEditDeadline, setDataEditDeadline] = React.useState(null);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // NEW: Memoized value for allowing data edits
  const isDataEditingAllowed = React.useMemo(() => {
    // If user is admin, always allow edits
    if (userProfileData && userProfileData.role === 'admin') {
      return true;
    }
    // Otherwise, apply the original deadline logic
    if (!settingsLoaded || !dataEditDeadline) return true; // If settings are not loaded or date is not defined, allow edits
    const now = new Date();
    const deadline = new Date(dataEditDeadline);
    return now <= deadline;
  }, [settingsLoaded, dataEditDeadline, userProfileData]); // Added userProfileData to dependencies


  // NEW: Local Auth Listener for ChangePhoneApp
  // This listener ensures that ChangePhoneApp reacts to authentication changes,
  // but primary logout/redirection is handled by GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("ChangePhoneApp: Local onAuthStateChanged - User:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // If user is not logged in, redirect (even if GNH should handle it)
      if (!currentUser) {
        console.log("ChangePhoneApp: User is not logged in, redirecting to login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Depends on auth instance

  // NEW: Local Effect for loading user data from Firestore
  // This effect will run when the user is logged in and db is available.
  // It assumes that passwordLastChanged and approved status are already verified in header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Only runs if user is logged in and db is available
      console.log(`ChangePhoneApp: Attempting to load user document for UID: ${user.uid}`);
      setLoading(true); // Set loading to true while profile data is being loaded

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          console.log("ChangePhoneApp: onSnapshot for user document triggered.");
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("ChangePhoneApp: User document exists, data:", userData);

            // --- IMMEDIATE LOGOUT IF passwordLastChanged IS NOT A VALID TIMESTAMP ---
            // This is added logic that runs immediately after data is loaded.
            // If passwordLastChanged is invalid or missing, log out.
            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                console.error("ChangePhoneApp: passwordLastChanged IS NOT a valid Timestamp object! Type:", typeof userData.passwordLastChanged, "Value:", userData.passwordLastChanged);
                console.log("ChangePhoneApp: Immediately logging out user due to invalid password change timestamp.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Clear localStorage
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            // Normal processing if passwordLastChanged is valid
            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
            const localStorageKey = `passwordLastChanged_${user.uid}`;
            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

            console.log(`ChangePhoneApp: Firestore passwordLastChanged (converted): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                // First load for this user/browser, initialize localStorage and DO NOT LOG OUT
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangePhoneApp: Initializing passwordLastChanged in localStorage (first load).");
                // Do not continue here, continue with normal data processing for first load
            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                // Password was changed on another device/session
                console.log("ChangePhoneApp: Password change detected on another device/session. Logging out user.");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                // This ideally should not happen if Firestore is the source of truth
                console.warn("ChangePhoneApp: Detected older timestamp from Firestore than stored. Logging out user (potential mismatch).");
                auth.signOut(); // Use auth from React state
                window.location.href = 'login.html';
                localStorage.removeItem(localStorageKey);
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return;
            } else {
                // Times are the same, ensure localStorage is up-to-date
                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                console.log("ChangePhoneApp: Timestamps are the same, updating localStorage.");
            }

            // NEW LOGIC: Logout if user is admin and not approved
            if (userData.role === 'admin' && userData.approved === false) {
                console.log("ChangePhoneApp: User is admin and not approved. Logging out.");
                auth.signOut();
                window.location.href = 'login.html';
                setUser(null); // Explicitly set user to null
                setUserProfileData(null); // Explicitly set userProfileData to null
                return; // Stop further processing
            }

            setUserProfileData(userData); // Update userProfileData state
            
            // Update local states from userProfileData
            // Split phone number into dial code and actual number
            const fullPhoneNumber = userData.contactPhoneNumber || '';
            let initialDialCode = '+421'; // Default to Slovakia
            let initialPhoneNumber = fullPhoneNumber;

            // Try to find a matching dial code and separate it from the number
            for (const country of countryCodes) {
              if (fullPhoneNumber.startsWith(country.dialCode)) {
                initialDialCode = country.dialCode;
                initialPhoneNumber = fullPhoneNumber.substring(country.dialCode.length);
                break;
              }
            }
            setSelectedCountryDialCode(initialDialCode);
            setContactPhoneNumber(initialPhoneNumber); // Set only the number

            setLoading(false); // Stop loading after user data is loaded
            setError(''); // Clear errors after successful load

            // Update menu visibility after role is loaded (call global function from left-menu.js)
            if (typeof window.updateMenuItemsVisibility === 'function') {
                window.updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("ChangePhoneApp: Function updateMenuItemsVisibility is not defined.");
            }

            console.log("ChangePhoneApp: User data loading complete, loading: false");
          } else {
            console.warn("ChangePhoneApp: User document not found for UID:", user.uid);
            setError("Error: User profile not found or you do not have sufficient permissions. Please try logging in again.");
            setLoading(false); // Stop loading so error can be displayed
            setUser(null); // Explicitly set user to null
            setUserProfileData(null); // Explicitly set userProfileData to null
          }
        }, error => {
          console.error("ChangePhoneApp: Error loading user data from Firestore (onSnapshot error):", error);
          if (error.code === 'permission-denied') {
              setError(`Permission error: You do not have access to your profile. Please try logging in again or contact support.`);
          } else if (error.code === 'unavailable') {
              setError(`Connection error: Firestore service is unavailable. Please try again later.`);
          } else if (error.code === 'unauthenticated') {
               setError(`Authentication error: You are not logged in. Please try logging in again.`);
               if (auth) {
                  auth.signOut();
                  window.location.href = 'login.html';
                  setUser(null); // Explicitly set user to null
                  setUserProfileData(null); // Explicitly set userProfileData to null
               }
          } else {
              setError(`Error loading user data: ${error.message}`);
          }
          setLoading(false); // Stop loading even on error
          console.log("ChangePhoneApp: User data loading failed, loading: false");
          setUser(null); // Explicitly set user to null
          setUserProfileData(null); // Explicitly set userProfileData to null
        });
      } catch (e) {
        console.error("ChangePhoneApp: Error setting up onSnapshot for user data (try-catch):", e);
        setError(`Error setting up listener for user data: ${e.message}`);
        setLoading(false); // Stop loading even on error
        setUser(null); // Explicitly set user to null
        setUserProfileData(null); // Explicitly set userProfileData to null
      }
    } else if (user === null) {
        // If user is null (and not undefined), it means they have been logged out.
        // Redirection should already be handled by GlobalNotificationHandler.
        // Here, we just ensure loading is false and data is cleared.
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      // Unsubscribe from onSnapshot on unmount
      if (unsubscribeUserDoc) {
        console.log("ChangePhoneApp: Unsubscribing onSnapshot for user document.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Depends on user and db (and auth for signOut)

  // NEW: Effect for loading settings (data editing deadline)
  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      if (!db) {
        console.log("ChangePhoneApp: Waiting for DB to load settings.");
        return;
      }
      try {
          console.log("ChangePhoneApp: Attempting to load registration settings for data editing deadline.");
          const settingsDocRef = db.collection('settings').doc('registration');
          unsubscribeSettings = settingsDocRef.onSnapshot(docSnapshot => {
            console.log("ChangePhoneApp: onSnapshot for registration settings triggered.");
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                console.log("ChangePhoneApp: Registration settings exist, data:", data);
                setDataEditDeadline(data.dataEditDeadline ? data.dataEditDeadline.toDate().toISOString() : null); // Use ISO string for consistency
            } else {
                console.log("ChangePhoneApp: Registration settings not found in Firestore. Data editing deadline is not defined.");
                setDataEditDeadline(null);
            }
            setSettingsLoaded(true);
            console.log("ChangePhoneApp: Settings loading complete, settingsLoaded: true.");
          }, error => {
            console.error("ChangePhoneApp: Error loading registration settings (onSnapshot error):", error);
            setError(`Error loading settings: ${error.message}`);
            setSettingsLoaded(true);
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("ChangePhoneApp: Unsubscribing onSnapshot for registration settings.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("ChangePhoneApp: Error setting up onSnapshot for registration settings (try-catch):", e);
          setError(`Error setting up listener for settings: ${e.message}`);
          setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [db]); // Depends only on 'db'


  const handleUpdatePhoneNumber = async (e) => {
    e.preventDefault();
    // NEW: Check for data editing permission
    if (!isDataEditingAllowed) {
      setError("Editing phone number is forbidden after the deadline.");
      return;
    }

    // NEW: Check if phone number is empty before submitting
    if (contactPhoneNumber.trim() === '') {
        setError("Phone number cannot be empty.");
        return;
    }

    if (!db || !user || !userProfileData) {
      setError("Database or user is not available.");
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
      setUserNotificationMessage("Phone number successfully updated!");

      // --- Logic for saving notification for administrators ---
      try {
          // Use fixed 'default-app-id' for notification path
          const appId = 'default-app-id'; 
          let notificationMessage = '';
          let notificationRecipientId = '';

          // Specific message about phone number change
          if (userProfileData.role === 'user') {
              notificationMessage = `User ${userProfileData.email} changed their phone number to ${fullPhoneNumber}.`;
              notificationRecipientId = 'all_admins'; // Notification for all administrators
          } else if (userProfileData.role === 'admin') {
              notificationMessage = `Administrator ${userProfileData.email} changed their phone number to ${fullPhoneNumber}.`;
              notificationRecipientId = user.uid; // Notification for this specific administrator
          }

          if (notificationMessage) {
              await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                  message: notificationMessage,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                  recipientId: notificationRecipientId,
                  read: false
              });
              console.log("Notification about phone number change successfully saved to Firestore.");
          }
      } catch (e) {
          console.error("ChangePhoneApp: Error saving notification about phone number change:", e);
      }
      // --- End of notification saving logic ---

    } catch (e) {
      console.error("ChangePhoneApp: Error updating phone number:", e);
      setError(`Error updating phone number: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Check if the form is valid to enable the button
  const isFormValid = contactPhoneNumber.trim() !== '';

  // Display loading state
  if (!user || (user && !userProfileData) || !settingsLoaded || loading) {
    if (user === null) {
        console.log("ChangePhoneApp: User is null, redirecting to login.html");
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (user && !settingsLoaded) { // NEW: Waiting for settings to load
        loadingMessage = 'Načítavam nastavenia...';
    } else if (user && settingsLoaded && !userProfileData) {
        loadingMessage = 'Načítavam profilové dáta...';
    } else if (loading) {
        loadingMessage = 'Ukladám zmeny...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Redirect for users with 'admin' role or unapproved users
  if (userProfileData && (userProfileData.role !== 'user' || userProfileData.approved !== true)) {
    console.log("ChangePhoneApp: User is not an approved user, redirecting.");
    window.location.href = 'logged-in-my-data.html'; // Redirect to logged-in-my-data.html
    return null;
  }

  // ChevronDown icon (Lucide React equivalent - inline SVG)
  const ChevronDown = React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
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

  // Dynamic classes for the button based on disabled state
  const buttonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${loading || !isDataEditingAllowed || !isFormValid // CHANGE: Added isFormValid check
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Disabled state
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Active state
    }
  `;

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
      // NEW: Data editing deadline message
      !isDataEditingAllowed && userProfileData && userProfileData.role !== 'admin' && React.createElement(
        'div',
        { className: 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        `Úpravy telefónneho čísla sú povolené len do ${dataEditDeadline ? new Date(dataEditDeadline).toLocaleDateString('sk-SK') + ' ' + new Date(dataEditDeadline).toLocaleTimeString('sk-SK') : 'nedefinovaného dátumu'}.`
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Zmeniť telefónne číslo' // Main heading
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
                    className: 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded-l-lg border border-r-0 border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 flex-shrink-0 flex items-center', // Added flex items-center
                    disabled: loading || !isDataEditingAllowed, // NEW: Disabled if after deadline
                  },
                  selectedCountryDialCode, // Display selected dial code
                  ChevronDown // Add chevron icon
                ),
                React.createElement('input', {
                  type: 'tel', // Use type="tel" for phone numbers
                  id: 'contact-phone-number',
                  className: 'shadow appearance-none border rounded-r-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                  value: contactPhoneNumber, // Only the number itself
                  onChange: (e) => setContactPhoneNumber(e.target.value),
                  required: true,
                  disabled: loading || !isDataEditingAllowed, // NEW: Disabled if after deadline
                  placeholder: 'Zadajte telefónne číslo'
                })
              )
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: buttonClasses, // Use dynamic classes
                disabled: loading || !isDataEditingAllowed || !isFormValid, // CHANGE: Disabled if after deadline or form is invalid
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
      disabled: loading || !isDataEditingAllowed, // Pass the loading state to disable buttons in modal, NEW: Disabled if after deadline
    })
  );
}

// Explicitly expose the component globally
window.ChangePhoneApp = ChangePhoneApp;
