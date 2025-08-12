// register-page1.js
// Obsahuje komponenty pre prvú stranu registračného formulára:
// Page1Form, PasswordInput, CountryCodeModal

// Zoznam krajín a ich predvolieb pre telefónne číslo (rozšírený a zoradený)
import { countryDialCodes as countryCodes } from './countryDialCodes.js';

// PasswordInput Component pre polia hesla s prepínačom viditeľnosti
export function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, preDescription, validationRules, tabIndex, onFocus }) { // Pridaný onFocus prop
  // SVG ikony pre oko (zobraziť heslo) a preškrtnuté oko (skryť heslo)
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { fill: 'currentColor', stroke: 'none', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' }),
    React.createElement('line', { x1: '21', y1: '3', x2: '3', y2: '21', stroke: 'currentColor', strokeWidth: '2' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4' },
    preDescription && React.createElement('p', { className: 'text-gray-600 text-sm mb-1' }, preDescription),
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, 
      label,
      React.createElement('sup', { className: 'text-red-500 text-xs ml-1' }, '*') // Single asterisk for password fields
    ),
    React.createElement(
      'div',
      { className: 'relative shadow border rounded-lg w-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white border-none rounded-none',
        value: value,
        onChange: onChange,
        onCopy: onCopy,
        onPaste: onPaste,
        onCut: onCut,
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
        tabIndex: tabIndex,
        onFocus: onFocus // Pridaný onFocus prop
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 focus:outline-none',
          tabIndex: -1,
          disabled: disabled,
        },
        showPassword ? EyeIcon : EyeOffIcon
      )
    ),
    validationRules && React.createElement( // Podmienené zobrazenie zoznamu
      'div',
      { className: 'text-gray-600 text-xs italic mt-1' },
      React.createElement('p', { className: 'font-semibold mb-1' }, 'Heslo musí obsahovať:'),
      React.createElement(
        'ul',
        { className: 'list-none pl-0' },
        validationRules.map((rule, index) =>
          React.createElement(
            'li',
            { key: index, className: `flex items-center ${rule.met ? 'text-green-600' : 'text-gray-600'}` },
            rule.met ? React.createElement('span', { className: 'mr-2 text-green-500' }, '✔') : React.createElement('span', { className: 'mr-2' }, '•'),
            rule.text
          )
        )
      )
    )
  );
}

// CountryCodeModal Component pre výber predvolby telefónneho čísla
export function CountryCodeModal({ isOpen, onClose, onSelect, selectedCode, disabled }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [tempSelectedCode, setTempSelectedCode] = React.useState(selectedCode);
  const modalRef = React.useRef(null);
  const inputRef = React.useRef(null); // Ref pre input pole

  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedCode(selectedCode);
      setSearchTerm(''); 
      // Automatické zaostrenie na input pole pri otvorení modalu
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [isOpen, selectedCode]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleEscapeKey);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredCountries = countryCodes.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.dialCode.includes(searchTerm)
  );

  // Zmenená logika triedenia: Vždy abecedne podľa názvu krajiny
  const sortedFilteredCountries = [...filteredCountries].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  // Odstránené tlačidlo Potvrdiť, takže táto funkcia už nie je potrebná
  // const handleConfirm = () => {
  //   onSelect(tempSelectedCode);
  //   onClose();
  // };

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      {
        className: 'modal-content bg-white p-6 rounded-lg shadow-xl w-11/12 max-w-md mx-auto relative', // Pridané 'relative' pre tlačidlo zatvoriť
        ref: modalRef
      },
      React.createElement(
        'button',
        {
          onClick: onClose,
          className: 'absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-2xl font-bold focus:outline-none',
          'aria-label': 'Zatvoriť modálne okno'
        },
        '×'
      ),
      React.createElement(
        'h3',
        { className: 'text-xl font-bold mb-4 text-center text-gray-800' },
        'Vybrať predvoľbu'
      ),
      React.createElement('input', {
        type: 'text',
        placeholder: 'Hľadať krajinu alebo kód...',
        className: 'w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700',
        value: searchTerm,
        onChange: (e) => setSearchTerm(e.target.value),
        ref: inputRef // Priradenie ref k inputu
      }),
      React.createElement(
        'div',
        { className: 'max-h-80 overflow-y-auto border border-gray-200 rounded-lg' }, // Zmenené triedy pre lepší vzhľad
        sortedFilteredCountries.map((country) =>
          React.createElement(
            'button',
            {
              // Opravený kľúč pre jedinečnosť
              key: `${country.code}-${country.name}`, 
              className: `w-full text-left p-3 text-base flex justify-between items-center
                          ${tempSelectedCode === country.dialCode ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-50 text-gray-800'}
                          border-b border-gray-200 last:border-b-0 focus:outline-none focus:ring-2 focus:ring-blue-500`,
              onClick: () => {
                onSelect(country.dialCode); // Nastaví vybranú predvoľbu
                onClose(); // Okamžité zatvorenie modálneho okna
              },
              disabled: disabled,
            },
            React.createElement('span', null, `${country.name} (${country.dialCode})`),
            tempSelectedCode === country.dialCode && React.createElement(
              'svg',
              { className: 'h-5 w-5 text-blue-600', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M5 13l4 4L19 7' })
            )
          )
        )
      )
      // Odstránený div s tlačidlami "Zrušiť" a "Potvrdiť"
    )
  );
}

// NOVINKA: Funkcia na validáciu emailu (presunutá z App komponentu)
const validateEmail = (email) => {
  // Kontrola pre '@'
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return false;

  // Kontrola pre '.' po '@'
  const domainPart = email.substring(atIndex + 1);
  const dotIndexInDomain = domainPart.indexOf('.');
  if (dotIndexInDomain === -1) return false;

  // Kontrola pre aspoň dva znaky po poslednej bodke v doméne
  const lastDotIndex = email.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex < atIndex) return false; // Bodka musí byť po @
  
  const charsAfterLastDot = email.substring(lastDotIndex + 1);
  return charsAfterLastDot.length >= 2;
};

// Page1Form Component
export function Page1Form({ formData, handleChange, handleNext, loading, notificationMessage, closeNotification, isCountryCodeModalOpen, setIsCountryCodeModalOpen, setSelectedCountryDialCode, selectedCountryDialCode, NotificationModal, isRegistrationOpen, countdownMessage, registrationStartDate, isRecaptchaReady, isRegistrationClosed, registrationEndDate }) { // Pridaný registrationEndDate
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  // NOVINKA: Stav pre sledovanie, či bol input "Potvrdiť heslo" aktivovaný
  const [confirmPasswordTouched, setConfirmPasswordTouched] = React.useState(false);
  // NOVINKA: Stav pre sledovanie, či bol input "Email" aktivovaný
  const [emailTouched, setEmailTouched] = React.useState(false);

  // Ref pre input telefónneho čísla, aby sme mohli manipulovať s kurzorom
  const phoneInputRef = React.useRef(null);


  const toggleShowPassword = () => setShowPassword(prev => !prev);
  const toggleShowConfirmPassword = () => setShowConfirmPassword(prev => !prev);

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

  const now = new Date();
  const registrationStartDateObj = registrationStartDate ? new Date(registrationStartDate) : null; 
  const registrationEndDateObj = registrationEndDate ? new Date(registrationEndDate) : null; // Konverzia dátumu ukončenia

  // Funkcia na overenie hesla a vrátenie stavu pravidiel
  const getPasswordValidationRules = (password) => {
    const rules = [
      { text: 'aspoň 10 znakov', met: password.length >= 10 }, // Zmenené na 10 znakov
      { text: 'aspoň jedno malé písmeno', met: /[a-z]/.test(password) },
      { text: 'aspoň jedno veľké písmeno', met: /[A-Z]/.test(password) },
      { text: 'aspoň jednu číslicu', met: /\d/.test(password) },
    ];
    return rules;
  };

  const passwordValidationRules = getPasswordValidationRules(formData.password);
  // Pre potvrdenie hesla nebudeme zobrazovať zoznam validácie
  // const confirmPasswordValidationRules = getPasswordValidationRules(formData.confirmPassword);

  // Helper funkcia na mapovanie pozície kurzora z vyčistenej hodnoty na naformátovanú hodnotu
  const getFormattedCursorPos = (rawPos, newCleanedValue, newFormattedValue) => {
    let formattedPos = 0;
    let currentCleanedCharCount = 0; 

    for (let i = 0; i < newFormattedValue.length; i++) {
        if (newFormattedValue[i] === ' ') {
            if (currentCleanedCharCount >= rawPos) {
                 return formattedPos; // Ak je kurzor pred touto medzerou, vrátiť pozíciu pred medzerou
            }
        } else {
            currentCleanedCharCount++; 
        }
        formattedPos++; 

        if (currentCleanedCharCount === rawPos) {
            return formattedPos;
        }
    }
    return newFormattedValue.length; 
  };


  // NOVÁ FUNKCIA: Manipulácia s telefónnym číslom (formátovanie a Backspace)
  const handlePhoneNumberInputChange = (e) => {
      const input = e.target;
      const originalValue = input.value; 
      const originalCursorPos = input.selectionStart;

      // Získame pôvodnú pozíciu kurzora v "čistej" (iba čísla) hodnote
      let originalCleanedCursorPos = 0;
      for (let i = 0; i < originalCursorPos; i++) {
          if (originalValue[i] >= '0' && originalValue[i] <= '9') {
              originalCleanedCursorPos++;
          }
      }

      // Odstránime všetky nečíselné znaky z hodnoty
      let newCleanedValue = originalValue.replace(/\D/g, '');

      let newFormattedValue = '';
      for (let i = 0; i < newCleanedValue.length; i++) {
          newFormattedValue += newCleanedValue[i];
          if ((i + 1) % 3 === 0 && i + 1 < newCleanedValue.length) {
              newFormattedValue += ' ';
          }
      }

      // Aktualizujeme stav formulára
      handleChange({ target: { id: 'contactPhoneNumber', value: newFormattedValue } });

      // Nastavíme pozíciu kurzora po re-renderovaní
      setTimeout(() => {
          if (phoneInputRef.current) {
              // Pre vymazávanie a vkladanie musíme zistiť, kde sa kurzor nachádza v čistom reťazci
              let actualCleanedCursorPos = 0;
              let tempFormattedPos = 0;
              for(let i = 0; i < originalCursorPos; i++) {
                  if (originalValue[i] >= '0' && originalValue[i] <= '9') {
                      actualCleanedCursorPos++;
                  }
                  // Ak je originálna pozícia kurzora na medzere, posunieme čistú pozíciu, aby sa zohľadnil posun v čistom reťazci
                  if (originalValue[i] === ' ' && originalCursorPos === i + 1) {
                      actualCleanedCursorPos++; // simulate passing a digit
                  }
              }

              // Special handling for deletion when originalValue had a space just before cursor
              if (e.nativeEvent && e.nativeEvent.inputType === 'deleteContentBackward') { // Backspace
                // If the char before cursor in originalValue was a space, and the cursor was after it,
                // and the char before that was a digit, this means we are deleting the digit after a space
                if (originalCursorPos > 0 && originalValue.charAt(originalCursorPos - 1) === ' ' && originalValue.charAt(originalCursorPos - 2) !== ' ') {
                    actualCleanedCursorPos--; // Adjust to account for the deleted digit before the space
                }
              } else if (e.nativeEvent && e.nativeEvent.inputType === 'deleteContentForward') { // Delete key
                  // If the char at cursor in originalValue was a space, and the cursor was before it
                  if (originalValue.charAt(originalCursorPos) === ' ' && originalValue.charAt(originalCursorPos -1) !== ' ') {
                      // Do nothing, the originalCleanedCursorPos is already correct as we are deleting a non-digit
                  } else if (originalValue.charAt(originalCursorPos) >= '0' && originalValue.charAt(originalCursorPos) <= '9') {
                     // If we are deleting a digit, the cleaned cursor position should effectively stay where it is
                     // The getFormattedCursorPos will then map it correctly
                  }
              }
              
              const newCursorFormattedPos = getFormattedCursorPos(actualCleanedCursorPos, newCleanedValue, newFormattedValue);
              phoneInputRef.current.setSelectionRange(newCursorFormattedPos, newCursorFormattedPos);
          }
      }, 0);
  };

  const handlePhoneNumberKeyDown = (e) => {
    const input = e.target;
    const value = input.value;
    const cursorPosition = input.selectionStart;

    if (e.key === 'Backspace') {
        // Logika pre Backspace: Ak je kurzor na pozícii, kde bola medzera (4, 8, 12...),
        // a znak pred kurzorom je medzera, vymaže medzeru aj predchádzajúci znak.
        if (cursorPosition > 0 && cursorPosition % 4 === 0 && value.charAt(cursorPosition - 1) === ' ') {
            e.preventDefault(); // Zabrániť predvolenému správaniu Backspace

            // Odstrániť medzeru a číslicu pred ňou
            const newValue = value.substring(0, cursorPosition - 2) + value.substring(cursorPosition);
            
            // Aktualizovať stav formulára (toto spustí handlePhoneNumberInputChange na preformátovanie a nastavenie kurzora)
            // Musíme simulovať udalosť onChange, aby sa aktivovala naša logika preformátovania a pozície kurzora
            const syntheticEvent = {
                target: {
                    id: 'contactPhoneNumber',
                    value: newValue,
                    selectionStart: cursorPosition - 2, // Predpokladaná pozícia kurzora po vymazaní
                    selectionEnd: cursorPosition - 2,
                    // Pridáme inputType pre rozlíšenie v handlePhoneNumberInputChange
                    nativeEvent: { inputType: 'deleteContentBackward' } 
                }
            };
            handlePhoneNumberInputChange(syntheticEvent);
        }
    } else if (e.key === 'Delete') {
        // Logika pre Delete: Kurzor má zostať na pôvodnej pozícii a medzery sa preformátujú.
        if (cursorPosition < value.length) { 
            e.preventDefault(); 

            // Odstrániť znak na pozícii kurzora
            const newValue = value.substring(0, cursorPosition) + value.substring(cursorPosition + 1);
            
            // Simulujeme udalosť onChange
            const syntheticEvent = {
                target: {
                    id: 'contactPhoneNumber',
                    value: newValue,
                    selectionStart: cursorPosition, // Kurzor zostáva na pôvodnej pozícii
                    selectionEnd: cursorPosition,
                    nativeEvent: { inputType: 'deleteContentForward' }
                }
            };
            handlePhoneNumberInputChange(syntheticEvent);
        }
    }
    // Pre ostatné klávesy sa ponechá predvolené správanie prehliadača a handlePhoneNumberInputChange sa postará o formátovanie.
  };


  // Kontrola, či sú všetky povinné polia vyplnené
  const isFormValid = formData.firstName.trim() !== '' &&
                      formData.lastName.trim() !== '' &&
                      formData.email.trim() !== '' &&
                      validateEmail(formData.email) && // NOVINKA: Kontrola formátu emailu
                      formData.contactPhoneNumber.trim() !== '' &&
                      formData.password.length >= 10 && // Základná kontrola dĺžky hesla
                      /[a-z]/.test(formData.password) &&
                      /[A-Z]/.test(formData.password) &&
                      /\d/.test(formData.password) &&
                      formData.password === formData.confirmPassword &&
                      isRegistrationOpen &&
                      isRecaptchaReady;

  // Dynamické triedy pre tlačidlo "Ďalej"
  const nextButtonClasses = `
    font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200
    ${!isFormValid
      ? 'bg-white text-blue-500 border border-blue-500 cursor-not-allowed' // Zakázaný stav
      : 'bg-blue-500 hover:bg-blue-700 text-white' // Aktívny stav
    }
  `;

  return React.createElement(
    React.Fragment, // Používame React.Fragment namiesto div, aby sa zabránilo extra obdĺžniku
    null,
    React.createElement(NotificationModal, { message: notificationMessage, onClose: closeNotification }),

    // NOVINKA: Podmienené zobrazenie na základe stavu registrácie
    isRegistrationClosed ? (
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' }, // Zmenené triedy šírky
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-2 text-red-600' }, 
          'Registrácia na turnaj je už ukončená.'
        ),
        React.createElement(
          'p',
          { className: 'text-md text-gray-700 mt-2' },
          'Registrácia bola ukončená ',
          registrationEndDateObj && React.createElement(
            'span',
            { style: { whiteSpace: 'nowrap' } },
            'dňa ',
            registrationEndDateObj.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            ' o ',
            registrationEndDateObj.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
            ' hod.'
          )
        )
      )
    ) : (isRegistrationOpen === false && countdownMessage) ? (
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-md w-auto max-w-fit mx-auto text-center' }, // Zmenené triedy šírky
        React.createElement('h2', { className: 'text-2xl font-bold mb-2' }, 'Registračný formulár'), // Zmenený text
        registrationStartDateObj && !isNaN(registrationStartDateObj) && now < registrationStartDateObj && (
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'p',
              { className: 'text-md text-gray-700 mt-2' }, // Odstránená trieda whitespace-nowrap z <p>
              'Registrácia sa spustí ', // Zmenený text
              React.createElement(
                'span',
                { style: { whiteSpace: 'nowrap' } }, // span pre nezalamovanie dátumu a času
                'dňa ',
                registrationStartDateObj.toLocaleDateString('sk-SK', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                ' o ',
                registrationStartDateObj.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
                ' hod.'
              )
            ),
            countdownMessage && (
                React.createElement('p', { className: 'text-md text-gray-700 mt-2' }, React.createElement('strong', null, `Zostáva: ${countdownMessage}`))
            )
          )
        )
      )
    ) : (isRegistrationOpen === null) ? (
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
      // Toto je pôvodný obsah formulára, ktorý sa zobrazí iba ak je registrácia otvorená
      // Odstránený vonkajší div, ktorý spôsoboval duplicitný obdĺžnik.
      React.createElement(
        React.Fragment, // Používame React.Fragment, aby sme nepridávali ďalší zbytočný div
        null,
        React.createElement(
          'h2',
          { className: 'text-2xl font-bold mb-6 text-center text-gray-800' },
          'Registrácia - strana 1'
        ),
        React.createElement(
          'form',
          { onSubmit: handleNext, className: 'space-y-4' },
          React.createElement(
            'div',
            { className: 'border-t border-gray-200 pt-4 mt-4' },
            React.createElement('p', { className: 'text-gray-600 text-sm mb-1' }, 'Prosíme Vás o vyplnenie tohto formuláru. Ďakujeme.'),
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 
              'Meno kontaktnej osoby',
              React.createElement('sup', { className: 'text-red-500 text-xs ml-1' }, '*')
            ),
            React.createElement(
              'div',
              { className: 'shadow border rounded-lg w-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' },
              React.createElement('input', {
                type: 'text',
                id: 'firstName',
                className: 'w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white border-none rounded-none',
                value: formData.firstName,
                onChange: handleChange,
                required: true,
                placeholder: 'Zadajte vaše meno',
                tabIndex: 1,
                disabled: loading || !isRegistrationOpen || !isRecaptchaReady
              })
            )
          ),
          React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 
              'Priezvisko kontaktnej osoby',
              React.createElement('sup', { className: 'text-red-500 text-xs ml-1' }, '*')
            ),
            React.createElement(
              'div',
              { className: 'shadow border rounded-lg w-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' },
              React.createElement('input', {
                type: 'text',
                id: 'lastName',
                className: 'w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white border-none rounded-none',
                value: formData.lastName,
                onChange: handleChange,
                required: true,
                placeholder: 'Zadajte vaše priezvisko',
                tabIndex: 2,
                disabled: loading || !isRegistrationOpen || !isRecaptchaReady
              })
            )
          ),
          React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('p', { className: 'text-gray-600 text-sm mb-1' }, 'E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.'),
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'email' }, 
              'E-mailová adresa kontaktnej osoby',
              React.createElement('sup', { className: 'text-red-500 text-xs ml-1' }, '*')
            ),
            React.createElement(
              'div',
              { className: 'shadow border rounded-lg w-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' },
              React.createElement('input', {
                type: 'email',
                id: 'email',
                className: `w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white border-none rounded-none ${emailTouched && formData.email.trim() !== '' && !validateEmail(formData.email) ? 'border-red-500' : ''}`, // NOVINKA: červený okraj pre neplatný email
                value: formData.email,
                onChange: handleChange,
                onFocus: () => setEmailTouched(true), // NOVINKA: Nastaví touched stav
                required: true,
                placeholder: 'Zadajte svoju e-mailovú adresu',
                autoComplete: 'email',
                tabIndex: 3,
                disabled: loading || !isRegistrationOpen || !isRecaptchaReady
              })
            ),
            // NOVINKA: Zobrazenie správy pre neplatný email
            emailTouched && formData.email.trim() !== '' && !validateEmail(formData.email) &&
            React.createElement(
              'p',
              { className: 'text-red-500 text-xs italic mt-1' },
              'Zadajte platnú e-mailovú adresu.'
            )
          ),
          React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contactPhoneNumber' }, 
              'Telefónne číslo kontaktnej osoby',
              React.createElement('sup', { className: 'text-red-500 text-xs ml-1' }, '*')
            ),
            React.createElement(
              'div',
              { className: 'flex shadow border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200' },
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'bg-white text-gray-800 font-bold py-2 px-3 rounded-l-lg focus:outline-none flex-shrink-0 flex items-center',
                  onClick: () => setIsCountryCodeModalOpen(true),
                  tabIndex: 4,
                  disabled: loading || !isRegistrationOpen || !isRecaptchaReady
                },
                selectedCountryDialCode || '+XXX',
                ChevronDown
              ),
              React.createElement('input', {
                type: 'tel',
                id: 'contactPhoneNumber',
                className: 'w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none bg-white rounded-r-lg flex-grow min-w-0 border-none rounded-none',
                value: formData.contactPhoneNumber,
                onChange: handlePhoneNumberInputChange, // Používa novú funkciu pre zmeny
                onKeyDown: handlePhoneNumberKeyDown,   // Používa novú funkciu pre Backspace a Delete
                ref: phoneInputRef, // Pridáme ref pre manipuláciu s kurzorom
                required: true,
                placeholder: 'Zadajte telefónne číslo',
                tabIndex: 5,
                disabled: loading || !isRegistrationOpen || !isRecaptchaReady
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
            preDescription: 'E-mailová adresa a heslo budú potrebné na prípadnú neskoršiu úpravu údajov poskytnutých v tomto registračnom formulári.',
            validationRules: getPasswordValidationRules(formData.password), // Používame priamo funkciu
            tabIndex: 6,
            disabled: loading || !isRegistrationOpen || !isRecaptchaReady,
            showPassword: showPassword,
            toggleShowPassword: toggleShowPassword,
          }),
          React.createElement(PasswordInput, {
            id: 'confirmPassword',
            label: 'Potvrdiť heslo',
            value: formData.confirmPassword,
            onChange: (e) => {
                handleChange(e);
                setConfirmPasswordTouched(true); // Nastaví touched stav
            },
            onFocus: () => setConfirmPasswordTouched(true), // Nastaví touched stav pri aktivácii
            onCopy: (e) => e.preventDefault(),
            onPaste: (e) => e.preventDefault(),
            onCut: (e) => e.preventDefault(),
            placeholder: 'Zadajte heslo znova',
            autoComplete: 'new-password',
            tabIndex: 7,
            disabled: loading || !isRegistrationOpen || !isRecaptchaReady,
            showPassword: showConfirmPassword,
            toggleShowPassword: toggleShowConfirmPassword,
            showValidationList: false // Nezobrazovať zoznam pre toto pole
          }),
          // NOVINKA: Zobrazenie správy "Heslá sa nezhodujú"
          formData.password !== formData.confirmPassword && formData.confirmPassword.length > 0 && confirmPasswordTouched &&
          React.createElement(
            'p',
            { className: 'text-red-500 text-xs italic mt-1' },
            'Heslá sa nezhodujú'
          ),
          React.createElement(
            'button',
            {
              type: 'submit',
              className: nextButtonClasses, // Použitie dynamických tried
              disabled: !isFormValid, // Tlačidlo je zakázané, ak formulár nie je platný
              tabIndex: 8
            },
            loading ? React.createElement(
              'div',
              { className: 'flex items-center justify-center' },
              React.createElement('svg', { className: 'animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500', xmlns: 'http://www.w3.org/2000/svg', fill: 'none', viewBox: '0 0 24 24' }, // Farba spinneru zmenená na modrú
                React.createElement('circle', { className: 'opacity-25', cx: '12', cy: '12', r: '10', stroke: 'currentColor', strokeWidth: '4' }),
                React.createElement('path', { className: 'opacity-75', fill: 'currentColor', d: 'M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z' })
              ),
              'Ďalej...'
            ) : 'Ďalej'
          )
        )
      )
    ),
    React.createElement(CountryCodeModal, {
      isOpen: isCountryCodeModalOpen,
      onClose: () => setIsCountryCodeModalOpen(false),
      onSelect: setSelectedCountryDialCode,
      selectedCode: selectedCountryDialCode,
      disabled: loading || !isRegistrationOpen || !isRecaptchaReady,
    })
  );
}
