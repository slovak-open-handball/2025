import { formatToDatetimeLocal } from './helpers.js'; // Import helper function

function TournamentSettingsView({
  db,
  isAdmin,
  loading,
  setError,
  setUserNotificationMessage,
  registrationStartDate,
  setRegistrationStartDate,
  registrationEndDate,
  setRegistrationEndDate,
  userDataEditEndDate,
  setUserDataEditEndDate,
  handleSaveSettings // Pass the handler from App.js
}) {
  if (!isAdmin) {
    return <p className="text-red-500">Nemáte oprávnenie na zobrazenie týchto nastavení.</p>;
  }

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Nastavenia turnaja</h2>
      <form onSubmit={handleSaveSettings} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-start-date">Začiatok registrácie</label>
          <input
            type="datetime-local"
            id="reg-start-date"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={registrationStartDate}
            onChange={(e) => setRegistrationStartDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-end-date">Koniec registrácie</label>
          <input
            type="datetime-local"
            id="reg-end-date"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={registrationEndDate}
            onChange={(e) => setRegistrationEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="user-data-edit-end-date">Koniec úprav používateľských dát</label>
          <input
            type="datetime-local"
            id="user-data-edit-end-date"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={userDataEditEndDate}
            onChange={(e) => setUserDataEditEndDate(e.target.value)}
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200"
          disabled={loading}
        >
          {loading ? 'Ukladám...' : 'Uložiť nastavenia'}
        </button>
      </form>
    </div>
  );
}

export default TournamentSettingsView;
