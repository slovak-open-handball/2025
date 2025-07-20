function RoleEditModal({ userToEditRole, newRole, setNewRole, loading, closeRoleEditModal, handleUpdateUserRole }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Upraviť rolu pre {userToEditRole?.email}</h3>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-user-role">Nová rola</label>
          <select
            id="new-user-role"
            className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            disabled={loading}
          >
            <option value="user">Používateľ</option>
            <option value="admin">Administrátor</option>
          </select>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={closeRoleEditModal}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
            disabled={loading}
          >
            Zrušiť
          </button>
          <button
            onClick={handleUpdateUserRole}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
            disabled={loading}
          >
            {loading ? 'Ukladám...' : 'Uložiť'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleEditModal;
