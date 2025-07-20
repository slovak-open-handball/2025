import PasswordInput from './PasswordInput.js'; // Import PasswordInput component

function ChangePasswordView({
  user,
  auth,
  loading,
  setError,
  setUserNotificationMessage,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setNewConfirmPassword,
  showCurrentPasswordChange,
  setShowCurrentPasswordChange,
  showNewPasswordChange,
  setShowNewPasswordChange,
  showConfirmNewPasswordChange,
  setShowConfirmNewPasswordChange,
  handleChangePassword // Pass the handler from App.js
}) {
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Zmeniť heslo</h2>
      <form onSubmit={handleChangePassword} className="space-y-4">
        <PasswordInput
          id="current-password"
          label="Aktuálne heslo"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Zadajte aktuálne heslo"
          autoComplete="current-password"
          showPassword={showCurrentPasswordChange}
          toggleShowPassword={() => setShowCurrentPasswordChange(!showCurrentPasswordChange)}
          disabled={loading}
        />
        <PasswordInput
          id="new-password"
          label="Nové heslo"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Zadajte nové heslo (min. 10 znakov)"
          autoComplete="new-password"
          showPassword={showNewPasswordChange}
          toggleShowPassword={() => setShowNewPasswordChange(!showNewPasswordChange)}
          disabled={loading}
          description={
            <>
              Heslo musí obsahovať:
              <ul className="list-disc list-inside ml-4">
                  <li>aspoň jedno malé písmeno,</li>
                  <li>aspoň jedno veľké písmeno,</li>
                  <li>aspoň jednu číslicu.</li>
              </ul>
            </>
          }
        />
        <PasswordInput
          id="confirm-new-password"
          label="Potvrďte nové heslo"
          value={confirmNewPassword}
          onChange={(e) => setNewConfirmPassword(e.target.value)}
          placeholder="Potvrďte nové heslo"
          autoComplete="new-password"
          showPassword={showConfirmNewPasswordChange}
          toggleShowPassword={() => setShowConfirmNewPasswordChange(!showConfirmNewPasswordChange)}
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
          disabled={loading}
        >
          {loading ? 'Ukladám...' : 'Zmeniť heslo'}
        </button>
      </form>
    </div>
  );
}

export default ChangePasswordView;
