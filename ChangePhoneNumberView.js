import PasswordInput from './PasswordInput.js'; // Import PasswordInput component

function ChangePhoneNumberView({
  user,
  auth,
  db,
  appId,
  loading,
  setError,
  setUserNotificationMessage,
  isEditAllowed,
  userDataEditEndDate,
  currentPassword,
  setCurrentPassword,
  newContactPhoneNumber,
  setNewContactPhoneNumber,
  showCurrentPasswordChange,
  setShowCurrentPasswordChange,
  handleChangeContactPhoneNumber // Pass the handler from App.js
}) {

  const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Zmeniť telefónne číslo</h2>
      {!isEditAllowed && (
          <p className="text-red-500 text-sm mt-2">
              Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: {editEnd ? editEnd.toLocaleString('sk-SK') : '-'}
          </p>
      )}
      <form onSubmit={handleChangeContactPhoneNumber} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-contact-phone-number">Nové telefónne číslo</label>
          <input
            type="tel"
            id="new-contact-phone-number"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={newContactPhoneNumber}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '') {
                setNewContactPhoneNumber('');
                e.target.setCustomValidity('');
                return;
              }
              if (value.length === 1 && value !== '+') {
                e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                e.target.reportValidity();
                return;
              }
              if (value.length > 1 && !/^\+\d*$/.test(value)) {
                e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                e.target.reportValidity();
                return;
              }
              setNewContactPhoneNumber(value);
              e.target.setCustomValidity('');
            }}
            onInvalid={(e) => {
                if (e.target.value.length === 0) {
                  e.target.setCustomValidity("Prosím, vyplňte toto pole.");
                } else if (e.target.value.length === 1 && e.target.value !== '+') {
                  e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+'.");
                } else if (e.target.value.length > 1 && !/^\+\d*$/.test(e.target.value)) {
                  e.target.setCustomValidity("Za znakom '+' sú povolené iba číslice.");
                } else {
                  e.target.setCustomValidity("Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567).");
                }
            }}
            required
            placeholder={user.contactPhoneNumber || "+421901234567"}
            pattern="^\+\d+$"
            title="Telefónne číslo musí začínať znakom '+' a obsahovať iba číslice (napr. +421901234567)."
            disabled={loading || !isEditAllowed}
          />
        </div>
        <PasswordInput
          id="current-password-phone-change"
          label="Aktuálne heslo (pre overenie)"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Zadajte aktuálne heslo"
          autoComplete="current-password"
          showPassword={showCurrentPasswordChange}
          toggleShowPassword={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
          disabled={loading || !isEditAllowed}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
          disabled={loading || !isEditAllowed}
        >
          {loading ? 'Ukladám...' : 'Uložiť zmeny'}
        </button>
      </form>
    </div>
  );
}

export default ChangePhoneNumberView;
