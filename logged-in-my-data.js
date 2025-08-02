// logged-in-my-data.js
// Tento súbor spravuje React komponent MyDataApp, ktorý zobrazuje
// profilové a registračné dáta prihláseného používateľa.
// Bol upravený, aby správne reagoval na globálnu udalosť 'globalDataUpdated'
// a zobrazoval dáta až po ich úplnom načítaní.
// Boli pridané zmeny pre dynamickú farbu hlavičiek na základe role používateľa,
// vylepšená logika pre zobrazenie fakturačných údajov,
// pridané tlačidlo na úpravu údajov a modálne okno.

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        // Zmenené na vycentrovanie obsahu na vrchu obrazovky
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        // Zmenené na vycentrovanie obsahu na vrchu obrazovky
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'p',
            { className: 'text-center text-red-500 text-lg' },
            message
        )
    );
};

/**
 * Získa URL pre ikonu na základe typu registrácie.
 * @param {string} registrationType - Typ registrácie.
 * @returns {string} URL ikony.
 */
const getRegistrationIcon = (registrationType) => {
    const iconMap = {
        'Základná registrácia': 'https://placehold.co/40x40/f0f9ff/0c4a6e?text=B', // Modrá pre základnú
        'Rozšírená registrácia': 'https://placehold.co/40x40/f0fdf4/14532d?text=P', // Zelená pre rozšírenú
        'Administrátor': 'https://placehold.co/40x40/fffbeb/92400e?text=A' // Oranžová pre administrátora
    };
    return iconMap[registrationType] || 'https://placehold.co/40x40/e2e8f0/64748b?text=N/A'; // Default ikona
};

/**
 * Formátuje telefónne číslo s predvoľbou.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return 'N/A';
    // Na nájdenie predvoľby použijeme globálny zoznam
    const dialCodes = window.countryDialCodes || [];
    const foundCode = dialCodes.find(code => phoneNumber.startsWith(code.dialCode));

    if (foundCode) {
        return phoneNumber.replace(foundCode.dialCode, `${foundCode.dialCode} `);
    }
    return phoneNumber;
};

/**
 * Komponent pre zobrazenie informácií o registrácii a type konta.
 */
const renderRegistrationInfo = (registrationType, isUserAdmin) => {
    const headerColor = isUserAdmin ? 'bg-orange-600' : (registrationType === 'Rozšírená registrácia' ? 'bg-green-600' : 'bg-blue-600');
    const iconSrc = getRegistrationIcon(registrationType);

    return React.createElement(
        'div',
        { className: `p-6 rounded-xl text-white ${headerColor} mb-6` },
        React.createElement(
            'div',
            { className: 'flex items-center space-x-4' },
            React.createElement('img', { src: iconSrc, alt: 'ikona typu konta', className: 'w-10 h-10 rounded-full' }),
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-sm' },
                    'Typ konta:'
                ),
                React.createElement(
                    'p',
                    { className: 'font-bold text-lg' },
                    registrationType
                )
            )
        )
    );
};

/**
 * Komponent pre zobrazenie fakturačných a adresných údajov.
 */
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    // Podmienka na zobrazenie sekcie pre fakturačné údaje a adresu
    if (userProfileData.registrationType !== 'Rozšírená registrácia' && userProfileData.registrationType !== 'Administrátor') {
        return null;
    }

    return React.createElement(
        'div',
        { className: 'bg-white p-6 rounded-xl shadow' },
        React.createElement(
            'div',
            { className: `p-4 -mx-6 -mt-6 mb-6 rounded-t-xl text-white ${headerColor} flex items-center justify-between` },
            React.createElement('h3', { className: 'text-xl font-semibold' }, 'Fakturačné a adresné údaje')
        ),
        React.createElement(
            'div',
            { className: 'space-y-4' },
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                ` ${userProfileData.companyName || 'N/A'}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                ` ${userProfileData.ico || 'N/A'}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                ` ${userProfileData.addressLine1 || 'N/A'}, ${userProfileData.city || 'N/A'}, ${userProfileData.country || 'N/A'}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
                ` ${userProfileData.zipCode || 'N/A'}`
            )
        )
    );
};

// =======================================================================
// NOVÁ FUNKCIONALITA: KOMPONENTY PRE ZMENU E-MAILU
// =======================================================================

// Komponent pre polia hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, showPassword, toggleShowPassword, disabled }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.25V21h-3v-2.75m0 0a3 3 0 116 0m-6 0c0-1.657 1.343-3 3-3s3 1.343 3-3' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M17.657 16.657A8 8 0 0112 21a8 8 0 01-5.657-2.343M12 5a8 8 0 015.657 2.343M12 5v16' })
  );

  return React.createElement(
    'div',
    { className: 'mb-4' },
    React.createElement(
      'label',
      { htmlFor: id, className: 'block text-gray-700 text-sm font-bold mb-2' },
      label
    ),
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        name: id,
        value: value,
        onChange: onChange,
        placeholder: placeholder,
        required: true,
        disabled: disabled,
        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10'
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
          'aria-label': showPassword ? 'Skryť heslo' : 'Zobraziť heslo',
          disabled: disabled,
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    )
  );
}

/**
 * Komponent pre zmenu e-mailovej adresy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {function} props.onCancel - Funkcia na zrušenie operácie.
 * @param {object} props.userProfile - Aktuálne dáta používateľa.
 */
function ChangeEmailApp({ onCancel, userProfile }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newEmail, setNewEmail] = useState(userProfile.email || '');
  const [password, setPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    // Validácia formulára
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isValid = isValidEmail(newEmail) && password.length > 0 && !emailError && !passwordError;
    setIsFormValid(isValid);
  }, [newEmail, password, emailError, passwordError]);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setNewEmail(value);
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Zadajte platnú e-mailovú adresu.');
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (e.target.value.length === 0) {
      setPasswordError('Heslo je povinné.');
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    if (!window.auth || !window.auth.currentUser || !window.showGlobalNotification || !window.db) {
      console.error("Firebase auth/db objekt alebo notifikačná funkcia nie sú dostupné.");
      setError("Chyba aplikácie. Prosím, skúste to znova.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updateEmail } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
      const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
      
      const credential = EmailAuthProvider.credential(
        window.auth.currentUser.email,
        password
      );
      await reauthenticateWithCredential(window.auth.currentUser, credential);

      await updateEmail(window.auth.currentUser, newEmail);
      
      const userDocRef = doc(window.db, 'users', window.auth.currentUser.uid);
      await updateDoc(userDocRef, { email: newEmail });

      if (window.showGlobalNotification) {
          window.showGlobalNotification('E-mailová adresa bola úspešne zmenená.', 'success');
      }
      onCancel(); // Vrátime sa na zobrazenie profilu
    } catch (err) {
      console.error("Chyba pri zmene e-mailu:", err);
      let errorMessage = 'Chyba pri ukladaní údajov. Skúste to prosím znova.';
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'Zadané heslo je nesprávne.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Táto e-mailová adresa sa už používa.';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'Pre zmenu e-mailu sa musíte znova prihlásiť.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const buttonClasses = `w-full rounded-lg px-4 py-2 font-bold text-white transition duration-300 ${
    loading || !isFormValid ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
  }`;

  const buttonCancelClasses = `w-full rounded-lg px-4 py-2 font-bold transition duration-300 bg-gray-200 text-gray-800 hover:bg-gray-300 mt-2`;
  
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex items-center justify-center p-4' },
    React.createElement(
      'div',
      { className: 'w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden' },
      React.createElement(
        'div',
        { className: 'p-8 sm:p-10' },
        React.createElement(
          'h2',
          { className: 'text-3xl font-extrabold text-gray-900 text-center mb-6' },
          'Zmeniť e-mailovú adresu'
        ),
        error && React.createElement('div', { className: 'text-red-500 text-sm mb-4 text-center' }, error),
        React.createElement(
          'form',
          { onSubmit: handleSubmit },
          React.createElement(
            'div',
            { className: 'space-y-6' },
            React.createElement(
              'div',
              null,
              React.createElement(
                'label',
                { htmlFor: 'new-email', className: 'block text-gray-700 text-sm font-bold mb-2' },
                'Nová e-mailová adresa'
              ),
              React.createElement('input', {
                type: 'email',
                id: 'new-email',
                name: 'new-email',
                value: newEmail,
                onChange: handleEmailChange,
                required: true,
                className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
                placeholder: 'Zadajte novú e-mailovú adresu',
                disabled: loading,
              }),
              emailError && React.createElement(
                'p',
                { className: 'text-red-500 text-xs italic mt-1' },
                emailError
              )
            ),
            React.createElement(PasswordInput, {
              id: 'current-password',
              label: 'Aktuálne heslo',
              value: password,
              onChange: handlePasswordChange,
              required: true,
              placeholder: 'Zadajte svoje aktuálne heslo',
              disabled: loading,
              showPassword: showCurrentPassword,
              toggleShowPassword: () => setShowCurrentPassword(!showCurrentPassword),
            }),
            passwordError && React.createElement(
              'p',
              { className: 'text-red-500 text-xs italic mt-1' },
              passwordError
            ),
            React.createElement(
              'button',
              {
                type: 'submit',
                className: buttonClasses,
                disabled: loading || !isFormValid,
              },
              loading ? 'Ukladám...' : 'Uložiť zmeny'
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: onCancel,
                className: buttonCancelClasses,
                disabled: loading,
              },
              'Zrušiť'
            )
          )
        )
      )
    )
  );
}

// =======================================================================
// HLAVNÝ KOMPONENT
// =======================================================================
const EditContactModal = ({ userProfileData, isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        firstName: userProfileData.firstName || '',
        lastName: userProfileData.lastName || '',
        contactPhoneNumber: userProfileData.contactPhoneNumber || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Synchronizácia dát, ak sa zmenia props
    useEffect(() => {
        setFormData({
            firstName: userProfileData.firstName || '',
            lastName: userProfileData.lastName || '',
            contactPhoneNumber: userProfileData.contactPhoneNumber || ''
        });
    }, [userProfileData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (!window.db || !window.auth || !window.auth.currentUser) {
                throw new Error("Firebase nie je inicializovaný alebo používateľ nie je prihlásený.");
            }
            const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const userDocRef = doc(window.db, 'users', window.auth.currentUser.uid);
            await updateDoc(userDocRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                contactPhoneNumber: formData.contactPhoneNumber
            });
            window.showGlobalNotification("Údaje boli úspešne aktualizované.", "success");
            onClose();
        } catch (err) {
            console.error("Chyba pri ukladaní údajov:", err);
            setError("Chyba pri ukladaní údajov. Skúste to prosím neskôr.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return React.createElement(
        'div',
        { className: 'modal-overlay' },
        React.createElement(
            'div',
            { className: 'modal-content w-full max-w-xl' },
            React.createElement(
                'h3',
                { className: 'text-2xl font-bold mb-4' },
                'Upraviť kontaktné údaje'
            ),
            error && React.createElement('div', { className: 'text-red-500 mb-4' }, error),
            React.createElement(
                'form',
                { onSubmit: handleSave },
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'firstName' }, 'Meno'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'firstName',
                        name: 'firstName',
                        value: formData.firstName,
                        onChange: handleInputChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight',
                        required: true
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'lastName' }, 'Priezvisko'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'lastName',
                        name: 'lastName',
                        value: formData.lastName,
                        onChange: handleInputChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight',
                        required: true
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'contactPhoneNumber' }, 'Telefónne číslo'),
                    React.createElement('input', {
                        type: 'text',
                        id: 'contactPhoneNumber',
                        name: 'contactPhoneNumber',
                        value: formData.contactPhoneNumber,
                        onChange: handleInputChange,
                        className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight'
                    })
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-4 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded transition duration-300'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`,
                            disabled: loading
                        },
                        loading ? 'Ukladám...' : 'Uložiť zmeny'
                    )
                )
            )
        )
    );
};

const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isChangingEmail, setIsChangingEmail] = useState(false);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [dataError, setDataError] = useState('');

    useEffect(() => {
        // Spracovanie globálnej udalosti s dátami používateľa
        const handleGlobalDataUpdate = (event) => {
            console.log("MyDataApp: Prijatá udalosť globalDataUpdated.");
            setIsDataLoading(false);
            if (event.detail) {
                setUserProfileData(event.detail);
            } else {
                setDataError('Chyba pri načítaní dát používateľa.');
            }
        };

        // Pridanie poslucháča udalostí
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Počiatočná kontrola pre prípad, že už dáta existujú
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsDataLoading(false);
        } else {
            // Ak nie, čakáme na udalosť, ale pre istotu zobrazíme loader
            setIsDataLoading(true);
        }

        // Cleanup funkcia pre poslucháčov
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    if (isDataLoading) {
        return React.createElement(Loader);
    }

    if (dataError) {
        return React.createElement(ErrorMessage, { message: dataError });
    }

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: "Nie ste prihlásený alebo dáta neboli nájdené." });
    }

    if (isChangingEmail) {
        return React.createElement(ChangeEmailApp, { onCancel: () => setIsChangingEmail(false), userProfile: userProfileData });
    }

    const isUserAdmin = userProfileData.registrationType === 'Administrátor';
    const headerColor = isUserAdmin ? 'bg-orange-600' : (userProfileData.registrationType === 'Rozšírená registrácia' ? 'bg-green-600' : 'bg-blue-600');

    return React.createElement(
        'div',
        { className: 'flex-grow container mx-auto p-4 md:p-8 pt-12 md:pt-16' },
        React.createElement(
            'h1',
            { className: 'text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 text-center' },
            'Moja zóna'
        ),
        renderRegistrationInfo(userProfileData.registrationType, isUserAdmin),
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-xl shadow mb-6' },
            React.createElement(
                'div',
                { className: `p-4 -mx-6 -mt-6 mb-6 rounded-t-xl text-white ${headerColor} flex items-center justify-between` },
                React.createElement('h2', { className: 'text-xl font-semibold' }, 'Osobné a kontaktné údaje'),
                React.createElement(
                    'div',
                    { className: 'flex space-x-2' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsChangingEmail(true),
                            className: 'bg-white text-gray-800 font-bold py-1 px-3 rounded-full text-sm hover:bg-gray-100 transition duration-300'
                        },
                        'Zmeniť e-mail'
                    ),
                    React.createElement(
                        'button',
                        {
                            onClick: () => setIsEditModalOpen(true),
                            className: 'bg-white text-gray-800 font-bold py-1 px-3 rounded-full text-sm hover:bg-gray-100 transition duration-300'
                        },
                        'Upraviť'
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko: '),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                    ` ${userProfileData.email}`
                ),
                // Podmienene vykreslí riadok s telefónnym číslom, ak používateľ nie je admin
                !isUserAdmin && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                    ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                ),
            )
        ),
        renderBillingAndAddressInfo(userProfileData, headerColor),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditModalOpen,
            onClose: () => setIsEditModalOpen(false)
        })
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
