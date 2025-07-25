// register-page2.js
// Obsahuje komponenty a logiku pre druhú stránku registračného formulára.

// Page2Form Component
export function Page2Form({ formData, handleChange, handlePrev, handleSubmit, loading, notificationMessage, closeNotification, NotificationModal }) {
  // handleBillingChange pre vnorené fakturačné údaje a špecifické formátovanie
  const handleBillingChange = (e) => {
    const { id, value } = e.target;
    let newValue = value;

    if (id === 'ico' || id === 'dic') {
      // Povoliť iba číslice pre IČO a DIČ
      newValue = value.replace(/[^0-9]/g, '');
    } else if (id === 'icDph') {
      // Formát IČ DPH: prvé dva znaky veľké písmená, potom len číslice
      const alphaPart = value.substring(0, 2).toUpperCase().replace(/[^A-Z]/g, '');
      const numericPart = value.substring(2).replace(/[^0-9]/g, '');
      newValue = alphaPart + numericPart;
    } else if (id === 'postalCode') {
      // PSČ validation: only numbers, exactly 5 digits, add space after 3rd digit
      const numericValue = value.replace(/[^0-9]/g, '');
      let formattedPostalCode = numericValue;
      if (numericValue.length > 3) {
          formattedPostalCode = numericValue.substring(0, 3) + ' ' + numericValue.substring(3, 5);
      }
      newValue = formattedPostalCode;
    }

    // Ak je pole súčasťou billing objektu
    if (['clubName', 'ico', 'dic', 'icDph'].includes(id)) {
      handleChange({ target: { id: 'billing', value: { ...formData.billing, [id]: newValue } } });
    } else {
      // Pre ostatné polia (ulica, popisné číslo, mesto, PSČ, štát)
      handleChange({ target: { id: id, value: newValue } });
    }
  };

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

      // Fakturačné údaje
      React.createElement(
        'div',
        { className: 'border-t border-gray-200 pt-4 mt-4' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Fakturačné údaje'),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'clubName' }, 'Oficiálny názov klubu'),
          React.createElement('input', {
            type: 'text',
            id: 'clubName',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.billing?.clubName || '', // Access nested property
            onChange: handleBillingChange,
            placeholder: 'Zadajte názov klubu (nepovinné)',
            tabIndex: 9,
            disabled: loading
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'ico' }, 'IČO'),
          React.createElement('input', {
            type: 'text', // Keep as text to allow filtering
            id: 'ico',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.billing?.ico || '',
            onChange: handleBillingChange,
            placeholder: 'Zadajte IČO (len čísla)',
            tabIndex: 10,
            disabled: loading
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'dic' }, 'DIČ'),
          React.createElement('input', {
            type: 'text', // Keep as text to allow filtering
            id: 'dic',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.billing?.dic || '',
            onChange: handleBillingChange,
            placeholder: 'Zadajte DIČ (len čísla)',
            tabIndex: 11,
            disabled: loading
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'icDph' }, 'IČ DPH'),
          React.createElement('input', {
            type: 'text', // Keep as text to allow filtering and uppercase conversion
            id: 'icDph',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.billing?.icDph || '',
            onChange: handleBillingChange,
            placeholder: 'Zadajte IČ DPH (napr. SK1234567890)',
            tabIndex: 12,
            disabled: loading
          })
        ),
      ),

      // Fakturačná adresa
      React.createElement(
        'div',
        { className: 'border-t border-gray-200 pt-4 mt-4' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4 text-gray-700' }, 'Fakturačná adresa'),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'street' }, 'Ulica'),
          React.createElement('input', {
            type: 'text',
            id: 'street',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.street, // This is a direct formData field
            onChange: handleChange, // Use general handleChange
            required: true,
            placeholder: 'Zadajte ulicu',
            tabIndex: 13,
            disabled: loading
          })
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'houseNumber' }, 'Popisné číslo'),
          React.createElement('input', {
            type: 'text',
            id: 'houseNumber',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: formData.houseNumber || '', // New field
            onChange: handleChange, // Use general handleChange
            required: true,
            placeholder: 'Zadajte popisné číslo',
            tabIndex: 14,
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
            value: formData.city, // This is a direct formData field
            onChange: handleChange, // Use general handleChange
            required: true,
            placeholder: 'Zadajte mesto',
            tabIndex: 15,
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
            value: formData.postalCode, // This is a direct formData field
            onChange: handleBillingChange, // Use handleBillingChange for PSČ formatting
            required: true,
            placeholder: 'Zadajte PSČ (napr. 123 45)',
            maxLength: 6, // Max length for 5 digits + 1 space
            tabIndex: 16,
            disabled: loading
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
            value: formData.country, // This is a direct formData field
            onChange: handleChange, // Use general handleChange
            required: true,
            placeholder: 'Zadajte štát',
            tabIndex: 17,
            disabled: loading
          })
        ),
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
            tabIndex: 18
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: loading,
            tabIndex: 19
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
