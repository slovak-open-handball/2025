// register-page2.js
// Obsahuje komponenty a logiku pre druhú stránku registračného formulára.

// Page2Form Component
export function Page2Form({ formData, handleChange, handlePrev, handleSubmit, loading, notificationMessage, closeNotification, userRole, handleRoleChange, NotificationModal }) {
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
