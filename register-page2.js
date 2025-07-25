// Page2Form Component
function Page2Form({
  clubName, setClubName,
  ico, setIco,
  dic, setDic,
  icDph, setIcDph,
  street, setStreet,
  houseNumber, setHouseNumber,
  zipCode, setZipCode,
  city, setCity,
  country, setCountry,
  isSubmitting,
  userNotificationMessage,
  onPreviousPage,
  onSubmit // This is the main submit handler from App
}) {
  return React.createElement(
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
          disabled: isSubmitting || !!userNotificationMessage,
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
            const value = e.target.value.replace(/\D/g, '');
            setIco(value);
          },
          placeholder: "Zadajte IČO (iba čísla)",
          disabled: isSubmitting || !!userNotificationMessage,
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
            const value = e.target.value.replace(/\D/g, '');
            setDic(value);
          },
          placeholder: "Zadajte DIČ (iba čísla)",
          disabled: isSubmitting || !!userNotificationMessage,
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
            if (value.length > 2) {
              value = value.substring(0,2).replace(/[^A-Z]/g, '') + value.substring(2).replace(/\D/g, '');
            } else {
              value = value.replace(/[^A-Z]/g, '');
            }
            setIcDph(value);
          },
          placeholder: "Zadajte IČ DPH (napr. SK1234567890)",
          disabled: isSubmitting || !!userNotificationMessage,
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
          disabled: isSubmitting || !!userNotificationMessage,
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
          disabled: isSubmitting || !!userNotificationMessage,
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
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 3) {
              value = value.substring(0, 3) + ' ' + value.substring(3, 5);
            }
            setZipCode(value);
          },
          maxLength: 6,
          required: true,
          placeholder: "123 45",
          disabled: isSubmitting || !!userNotificationMessage,
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
          disabled: isSubmitting || !!userNotificationMessage,
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
          disabled: isSubmitting || !!userNotificationMessage,
        })
      ),
      React.createElement(
        'div',
        { className: 'flex justify-between mt-6' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: onPreviousPage,
            className: 'bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: isSubmitting || !!userNotificationMessage,
          },
          'Späť'
        ),
        React.createElement(
          'button',
          {
            type: 'submit',
            onClick: onSubmit,
            className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200',
            disabled: isSubmitting || !!userNotificationMessage,
          },
          'Registrovať sa'
        )
      )
    )
  );
}
