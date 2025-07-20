// js/logged-in-password.js

function ChangePasswordComponent({ setLoading, setError, setMessage }) {
  const { auth, user } = useAuth(); // Získajte auth a user z AuthContext
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [showOldPassword, setShowOldPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    setPasswordError('');

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Nové heslá sa nezhodujú.');
      setLoading(false);
      return;
    }

    const validationMsg = validatePassword(newPassword);
    if (validationMsg) {
      setPasswordError(validationMsg);
      setLoading(false);
      return;
    }

    try {
      // Reautentifikácia používateľa je potrebná pre citlivé operácie ako zmena hesla
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, oldPassword);
      await user.reauthenticateWithCredential(credential);
      await user.updatePassword(newPassword);
      setMessage('Heslo bolo úspešne zmenené!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      console.error("Chyba pri zmene hesla:", err);
      let errorMessage = 'Nastala chyba pri zmene hesla.';
      if (err.code === 'auth/wrong-password') {
        errorMessage = 'Staré heslo je nesprávne.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Nové heslo je príliš slabé.';
      } else if (err.code === 'auth/requires-recent-login') {
        errorMessage = 'Pre zmenu hesla sa musíte znova prihlásiť. Prihláste sa a skúste to znovu.';
        // Voliteľné: Presmerovať na prihlasovaciu stránku
        // auth.signOut();
        // window.location.href = 'login.html';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-blue-700 mb-4">Zmena hesla</h2>
      <form onSubmit={handleChangePassword}>
        <PasswordInput
          id="old-password"
          label="Staré heslo"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          placeholder="Vaše staré heslo"
          autoComplete="current-password"
          showPassword={showOldPassword}
          toggleShowPassword={() => setShowOldPassword(!showOldPassword)}
        />
        <PasswordInput
          id="new-password"
          label="Nové heslo"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 8 znakov, veľké/malé písmeno, číslo, znak"
          autoComplete="new-password"
          showPassword={showNewPassword}
          toggleShowPassword={() => setShowNewPassword(!showNewPassword)}
          description={passwordError || "Heslo musí mať aspoň 8 znakov, veľké a malé písmeno, číslo a špeciálny znak."}
        />
        <PasswordInput
          id="confirm-new-password"
          label="Potvrdiť nové heslo"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Zopakujte nové heslo"
          autoComplete="new-password"
          showPassword={showNewPassword} // Použite rovnaký stav pre potvrdenie
          toggleShowPassword={() => setShowNewPassword(!showNewPassword)}
        />
        {passwordError && <p className="text-red-500 text-sm mb-4">{passwordError}</p>}
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Zmeniť heslo
          </button>
        </div>
      </form>
    </div>
  );
}
