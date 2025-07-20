function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, disabled, description }) {
  const EyeIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const EyeOffIcon = (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25" />
    </svg>
  );

  return (
    <div className="relative">
      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor={id}>{label}</label>
      <input
        type={showPassword ? "text" : "password"}
        id={id}
        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10"
        value={value}
        onChange={onChange}
        // Prevent copy/paste/cut for security
        onCopy={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={toggleShowPassword}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
        disabled={disabled}
      >
        {showPassword ? EyeOffIcon : EyeIcon}
      </button>
      {description && (
        <p className="text-gray-600 text-sm -mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

export default PasswordInput;
