// PasswordInput Component for password fields with visibility toggle
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM12 15a3 3 0 100-6 3 3 0 000 6z' }),
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M4 20 L20 4' })
  );

  return React.createElement(
    'div',
    null,
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement(
      'div',
      { className: 'relative flex items-center' },
      React.createElement('input', {
        type: showPassword ? 'text' : 'password',
        id: id,
        className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10 mb-0 mt-0',
        value: value,
        onChange: onChange,
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        required: true,
        placeholder: placeholder,
        autoComplete: autoComplete,
        disabled: disabled,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: toggleShowPassword,
          className: 'absolute right-0 pr-3 flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg top-1/2 -translate-y-1/2',
          disabled: disabled,
        },
        showPassword ? EyeOffIcon : EyeIcon
      )
    ),
    description && React.createElement(
      'div',
      { className: 'text-gray-600 text-sm mt-2' },
      description
    )
  );
}

// Page1Form Component
function Page1Form({
  email, setEmail,
  password, setPassword,
  confirmPassword, setConfirmPassword,
  firstName, setFirstName,
  lastName, setLastName,
  contactPhoneNumberLocal, setContactPhoneNumberLocal,
  selectedCountryDialCode, setSelectedCountryDialCode,
  isCountryCodeModalOpen, setIsCountryCodeModalOpen,
  showPasswordReg, setShowPasswordReg,
  showConfirmPasswordReg, setShowConfirmPasswordReg,
  is_admin_register_page,
  isSubmitting,
  userNotificationMessage,
  onNextPage,
  countryCodes, // Passed from App for CountryCodeModal
  validatePassword // Passed from App for description
}) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Údaje kontaktnej osoby'),
    React.createElement(
      'div',
      { className: 'space-y-4' },
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-first-name' },
          is_admin_register_page ? "Meno" : "Meno kontaktnej osoby"
        ),
        React.createElement('input', {
          type: 'text',
          id: 'reg-first-name',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: firstName,
          onChange: (e) => setFirstName(e.target.value),
          required: true,
          placeholder: "Zadajte svoje meno",
          autoComplete: "given-name",
          disabled: isSubmitting || !!userNotificationMessage,
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-last-name' },
          is_admin_register_page ? "Priezvisko" : "Priezvisko kontaktnej osoby"
        ),
        React.createElement('input', {
          type: 'text',
          id: 'reg-last-name',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: lastName,
          onChange: (e) => setLastName(e.target.value),
          required: true,
          placeholder: "Zadajte svoje priezvisko",
          autoComplete: "family-name",
          disabled: isSubmitting || !!userNotificationMessage,
        })
      ),
      is_admin_register_page ? (
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa'),
          React.createElement('input', {
            type: 'email',
            id: 'reg-email',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
            value: email,
            onChange: (e) => setEmail(e.target.value),
            required: true,
            placeholder: "Zadajte svoju e-mailovú adresu",
            autoComplete: "email",
            disabled: isSubmitting || !!userNotificationMessage,
          })
        )
      ) : (
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-phone-number' }, 'Telefónne číslo kontaktnej osoby'),
            React.createElement(
              'div',
              { className: 'flex items-center border border-gray-300 rounded-lg shadow-sm focus-within:border-blue-500 focus-within:shadow-outline transition-all duration-200' },
              React.createElement(
                'button',
                {
                  type: 'button',
                  onClick: () => setIsCountryCodeModalOpen(true),
                  className: 'flex-shrink-0 py-2 px-3 text-gray-700 leading-tight focus:outline-none rounded-l-lg hover:bg-gray-100 transition-colors duration-200 flex items-center',
                  disabled: isSubmitting || !!userNotificationMessage,
                },
                React.createElement('span', null, selectedCountryDialCode),
                React.createElement('svg', { className: 'ml-2 h-4 w-4 text-gray-600 inline-block', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                  React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' })
                )
              ),
              React.createElement('input', {
                type: 'tel',
                id: 'reg-phone-number',
                className: 'flex-grow py-2 px-3 text-gray-700 leading-tight focus:outline-none rounded-r-lg',
                value: contactPhoneNumberLocal,
                onChange: (e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  setContactPhoneNumberLocal(value);
                },
                required: true,
                placeholder: "Zadajte číslo",
                disabled: isSubmitting || !!userNotificationMessage,
              })
            )
          ),
          React.createElement(
            'p',
            { className: 'text-gray-600 text-sm -mt-2' },
            'E-mailová adresa bude slúžiť na všetku komunikáciu súvisiacu s turnajom - zasielanie informácií, faktúr atď.'
          )
        )
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-email' }, 'E-mailová adresa kontaktnej osoby'),
        React.createElement('input', {
          type: 'email',
          id: 'reg-email',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          required: true,
          placeholder: "Zadajte svoju e-mailovú adresu",
          autoComplete: "email",
          disabled: isSubmitting || !!userNotificationMessage,
        })
      ),
      React.createElement(
        'p',
        { className: 'text-gray-600 text-sm' },
        'Vytvorenie hesla umožní neskorší prístup k registračnému formuláru, v prípade potreby úpravy alebo doplnenia poskytnutých údajov.'
      ),
      React.createElement(PasswordInput, {
        id: 'reg-password',
        label: 'Heslo',
        value: password,
        onChange: (e) => setPassword(e.target.value),
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        placeholder: "Zvoľte heslo (min. 10 znakov)",
        autoComplete: "new-password",
        showPassword: showPasswordReg,
        toggleShowPassword: () => setShowPasswordReg(!showPasswordReg),
        disabled: isSubmitting || !!userNotificationMessage,
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
        )
      }),
      React.createElement(PasswordInput, {
        id: 'reg-confirm-password',
        label: 'Potvrďte heslo',
        value: confirmPassword,
        onChange: (e) => setConfirmPassword(e.target.value),
        onCopy: (e) => e.preventDefault(),
        onPaste: (e) => e.preventDefault(),
        onCut: (e) => e.preventDefault(),
        placeholder: "Potvrďte heslo",
        autoComplete: "new-password",
        showPassword: showConfirmPasswordReg,
        toggleShowPassword: () => setShowConfirmPasswordReg(!showConfirmPasswordReg),
        disabled: isSubmitting || !!userNotificationMessage,
      }),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: onNextPage,
          className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
          disabled: isSubmitting || !!userNotificationMessage,
        },
        'Ďalej'
      )
    )
  );
}
