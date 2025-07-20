import PasswordInput from './PasswordInput.js'; // Import PasswordInput component

function ChangeNameView({
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
  newFirstName,
  setNewFirstName,
  newLastName,
  setNewLastName,
  showCurrentPasswordChange,
  setShowCurrentPasswordChange,
  handleChangeName // Pass the handler from App.js
}) {

  const editEnd = userDataEditEndDate ? new Date(userDataEditEndDate) : null;

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Zmeniť meno a priezvisko</h2>
      {!isEditAllowed && (
          <p className="text-red-500 text-sm mt-2">
              Úpravy vašich údajov sú už uzavreté. Boli uzavreté dňa: {editEnd ? editEnd.toLocaleString('sk-SK') : '-'}
          </p>
      )}
      <form onSubmit={handleChangeName} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-first-name">Nové meno</label>
          <input
            type="text"
            id="new-first-name"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={newFirstName}
            onChange={(e) => setNewFirstName(e.target.value)}
            placeholder={user.firstName || "Zadajte nové meno"}
            autoComplete="given-name"
            disabled={loading || !isEditAllowed}
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-last-name">Nové priezvisko</label>
          <input
            type="text"
            id="new-last-name"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={newLastName}
            onChange={(e) => setNewLastName(e.target.value)}
            placeholder={user.lastName || "Zadajte nové priezvisko"}
            autoComplete="family-name"
            disabled={loading || !isEditAllowed}
          />
        </div>
        <PasswordInput
          id="current-password-name-change"
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

export default ChangeNameView;
