function MySettingsView({
  user,
  db,
  loading,
  setError,
  setUserNotificationMessage,
  handleToggleDisplayNotifications // Pass the handler from App.js
}) {
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Moje nastavenia</h2>
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm">
        <label htmlFor="display-notifications" className="text-gray-700 font-medium cursor-pointer flex-grow">
          Zobrazovať upozornenia na ploche
          <p className="text-sm text-gray-500 mt-1">
            Ak je táto možnosť zapnutá, budete dostávať pop-up upozornenia o nových správach a systémových hláseniach.
          </p>
        </label>
        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
          <input
            type="checkbox"
            name="toggle"
            id="display-notifications"
            className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
            checked={user.displayNotifications}
            onChange={handleToggleDisplayNotifications}
            disabled={loading}
          />
          <label htmlFor="display-notifications" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
        </div>
      </div>

      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #4CAF50; /* Green */
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #4CAF50; /* Green */
        }
        .toggle-label {
          background-color: #ccc;
        }
      `}</style>
    </div>
  );
}

export default MySettingsView;
