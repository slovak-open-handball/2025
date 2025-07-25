// register-page2.js
// Tento súbor obsahuje komponenty a logiku pre druhú stránku registračného formulára.

// Page2Form Component
// Očakáva NotificationModal ako prop, aby sa zabezpečilo, že je k dispozícii.
function Page2Form({ formData, handleChange, handlePrev, handleSubmit, loading, notificationMessage, closeNotification, NotificationModal, RECAPTCHA_SITE_KEY }) {
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
  }, [RECAPTCHA_SITE_KEY]); // Závislosť na RECAPTCHA_SITE_KEY

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

// Export the component for use in other files
export { Page2Form };
