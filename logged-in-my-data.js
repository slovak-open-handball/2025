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
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Pomocná funkcia na formátovanie telefónneho čísla.
 * @param {string} phoneNumber - Telefónne číslo na formátovanie.
 * @returns {string} Formátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
    if (match) {
        return `+${match[1]} ${match[2]} ${match[3]}`;
    }
    return phoneNumber;
};

/**
 * Funkcia na získanie farby hlavičky na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user').
 * @returns {string} Hex kód farby.
 */
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff'; // Farba pre admina
        case 'hall':
            return '#b06835'; // Farba pre halu
        case 'user':
            return '#9333EA'; // Farba pre bežného používateľa
        default:
            return '#374151'; // Predvolená tmavosivá
    }
};

/**
 * Komponent pre modálne okno na úpravu údajov.
 */
const EditContactModal = ({ userProfileData, isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    firstName: userProfileData.firstName || '',
    lastName: userProfileData.lastName || '',
    contactPhoneNumber: userProfileData.contactPhoneNumber || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Tu by sa odoslali aktualizované údaje do Firestore
    console.log("Saving data:", formData);
    onClose();
  };

  if (!isOpen) return null;

  return React.createElement(
    'div',
    { className: 'modal' },
    React.createElement(
      'div',
      { className: 'modal-content modal-content-sm' },
      React.createElement(
        'form',
        { onSubmit: handleSubmit },
        React.createElement(
          'h3',
          { className: 'text-2xl font-bold mb-4' },
          'Upraviť kontaktné údaje'
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { htmlFor: 'firstName', className: 'block text-gray-700 text-sm font-bold mb-2' },
            'Meno'
          ),
          React.createElement('input', {
            type: 'text',
            id: 'firstName',
            name: 'firstName',
            value: formData.firstName,
            onChange: handleChange,
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { htmlFor: 'lastName', className: 'block text-gray-700 text-sm font-bold mb-2' },
            'Priezvisko'
          ),
          React.createElement('input', {
            type: 'text',
            id: 'lastName',
            name: 'lastName',
            value: formData.lastName,
            onChange: handleChange,
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-6' },
          React.createElement(
            'label',
            { htmlFor: 'contactPhoneNumber', className: 'block text-gray-700 text-sm font-bold mb-2' },
            'Telefónne číslo'
          ),
          React.createElement('input', {
            type: 'text',
            id: 'contactPhoneNumber',
            name: 'contactPhoneNumber',
            value: formData.contactPhoneNumber,
            onChange: handleChange,
            className: 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
          })
        ),
        React.createElement(
          'div',
          { className: 'flex items-center justify-between' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline',
            },
            'Uložiť zmeny'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className: 'inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800',
            },
            'Zrušiť'
          )
        )
      )
    )
  );
};


/**
 * Komponent pre zobrazenie informácií o prihlásenom používateľovi.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        // Kontroluje, či sú globálne dáta už pripravené z 'authentication.js'
        if (window.isGlobalAuthReady) {
            handleGlobalData();
        } else {
            // Ak nie, počúva na udalosť, ktorá signalizuje ich pripravenosť
            window.addEventListener('globalDataUpdated', handleGlobalData);
        }

        // Cleanup funkcia pre event listener
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalData);
        };
    }, []);

    const handleGlobalData = () => {
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsLoading(false);
        } else {
            setError('Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.');
            setIsLoading(false);
        }
    };
    
    // Podmienene renderuje komponent na základe stavu načítania a chyby
    if (isLoading) {
        return React.createElement(Loader);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(ErrorMessage, { message: 'Nie ste prihlásený. Prosím, prihláste sa, aby ste videli svoje údaje.' });
    }

    const isUserAdmin = userProfileData.role === 'admin';
    const headerColor = getRoleColor(userProfileData.role);

    // Komponent na zobrazenie fakturačných údajov
    const renderBillingAndAddressInfo = (data, color) => {
        // Vylepšená kontrola, či existujú platné dáta, a ak nie, zobrazí správu.
        const hasBillingInfo = data.billingInfo && Object.keys(data.billingInfo).length > 0;
        
        return React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-xl overflow-hidden mb-8' },
            React.createElement(
                'div',
                { className: 'p-4 text-white font-bold text-xl', style: { backgroundColor: color } },
                React.createElement(
                    'h3',
                    null,
                    'Fakturačné údaje'
                )
            ),
            React.createElement(
                'div',
                { className: 'p-6' },
                hasBillingInfo ? 
                React.createElement(
                    React.Fragment,
                    null,
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Názov firmy:'),
                        ` ${data.billingInfo.companyName}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                        ` ${data.billingInfo.ico}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                        ` ${data.billingInfo.dic}`
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg' },
                        React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                        ` ${data.billingInfo.address}, ${data.billingInfo.city}, ${data.billingInfo.zipCode}`
                    )
                ) :
                React.createElement(
                    'p',
                    { className: 'text-gray-600' },
                    'Fakturačné údaje nie sú k dispozícii.'
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'container mx-auto p-4 md:p-8 lg:p-12 max-w-4xl' },
        React.createElement(
            'div',
            { className: 'space-y-8' },
            // Blok s kontaktnými údajmi
            React.createElement(
                'div',
                { className: 'bg-white rounded-lg shadow-xl overflow-hidden' },
                React.createElement(
                    'div',
                    { className: 'p-4 text-white font-bold text-xl flex justify-between items-center', style: { backgroundColor: headerColor } },
                    React.createElement(
                        'h3',
                        null,
                        'Kontaktná osoba'
                    ),
                    React.createElement(
                        'button',
                        { onClick: () => setIsEditModalOpen(true), className: 'text-white hover:text-gray-200 transition-colors duration-200' },
                        React.createElement(
                            'svg',
                            { className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6' },
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
            renderBillingAndAddressInfo(userProfileData, headerColor)
        ),
        React.createElement(EditContactModal, {
            userProfileData: userProfileData,
            isOpen: isEditModalOpen,
            onClose: () => setIsEditModalOpen(false)
        })
    );
};

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
