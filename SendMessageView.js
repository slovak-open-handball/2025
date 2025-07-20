function SendMessageView({
  user,
  db,
  appId,
  loading,
  setError,
  setUserNotificationMessage,
  allUsersData,
  checkedRecipients,
  setCheckedRecipients,
  messageSubject,
  setMessageSubject,
  messageContent,
  setMessageContent,
  searchQuery,
  setSearchQuery,
  filteredUsers,
  handleSendMessage,
  handleToggleAll,
  handleIndividualRecipientChange,
  isAllChecked
}) {
  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Poslať správu</h2>
      <form onSubmit={handleSendMessage} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message-subject">Predmet správy</label>
          <input
            type="text"
            id="message-subject"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={messageSubject}
            onChange={(e) => setMessageSubject(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message-content">Obsah správy</label>
          <textarea
            id="message-content"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 h-32"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            required
            disabled={loading}
          ></textarea>
        </div>

        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-3">Vybrať príjemcov:</h3>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Hľadať používateľa podľa mena alebo e-mailu..."
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-3"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="flex space-x-4 mb-4">
          <button
            type="button"
            onClick={() => handleToggleAll('all')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              isAllChecked('all') ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
            disabled={loading}
          >
            {isAllChecked('all') ? 'Odznačiť všetkých' : 'Označiť všetkých'}
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll('admin')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              isAllChecked('admin') ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
            disabled={loading}
          >
            {isAllChecked('admin') ? 'Odznačiť adminov' : 'Označiť adminov'}
          </button>
          <button
            type="button"
            onClick={() => handleToggleAll('user')}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
              isAllChecked('user') ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
            disabled={loading}
          >
            {isAllChecked('user') ? 'Odznačiť používateľov' : 'Označiť používateľov'}
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50">
          {filteredUsers.length === 0 ? (
            <p className="text-gray-600">Žiadni používatelia nenašli alebo zhodujúci sa s filtrom.</p>
          ) : (
            filteredUsers.map(u => (
              <div key={u.uid} className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id={`recipient-${u.uid}`}
                  checked={!!checkedRecipients[u.uid]}
                  onChange={() => handleIndividualRecipientChange(u.uid)}
                  className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  disabled={loading}
                />
                <label htmlFor={`recipient-${u.uid}`} className="text-gray-700">
                  {u.displayName} ({u.email}) {u.role === 'admin' && '(Admin)'}
                </label>
              </div>
            ))
          )}
        </div>

        <button
          type="submit"
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200 mt-6"
          disabled={loading}
        >
          {loading ? 'Odosielam...' : 'Odoslať správu'}
        </button>
      </form>
    </div>
  );
}

export default SendMessageView;
