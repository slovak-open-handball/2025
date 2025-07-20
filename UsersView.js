function UsersView({
  user,
  db,
  loading,
  setError,
  setUserNotificationMessage,
  allUsersData,
  openDeleteConfirmationModal,
  openRoleEditModal,
  handleApproveUser
}) {
  const adminUsers = allUsersData.filter(u => u.role === 'admin');
  const regularUsers = allUsersData.filter(u => u.role === 'user');

  return (
    <div className="space-y-6 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Správa používateľov</h2>

      {/* Admin Users Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Administrátori</h3>
        {adminUsers.length === 0 ? (
          <p className="text-gray-600">Žiadni administrátori neboli nájdení.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-md">
              <thead className="bg-gray-200">
                <tr>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">E-mail</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Meno</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Schválený</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {adminUsers.map((admin) => (
                  <tr key={admin.uid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-700">{admin.email}</td>
                    <td className="py-2 px-4 text-gray-700">{admin.displayName || `${admin.firstName} ${admin.lastName}`}</td>
                    <td className="py-2 px-4 text-gray-700">
                      {admin.approved ? (
                        <span className="text-green-600 font-semibold">Áno</span>
                      ) : (
                        <span className="text-red-600 font-semibold">Nie</span>
                      )}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex space-x-2">
                        {admin.uid !== user.uid && (
                          <>
                            {!admin.approved && (
                              <button
                                onClick={() => handleApproveUser(admin)}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors duration-200"
                                disabled={loading}
                              >
                                Schváliť
                              </button>
                            )}
                            <button
                              onClick={() => openRoleEditModal(admin)}
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors duration-200"
                              disabled={loading}
                            >
                              Zmeniť rolu
                            </button>
                            <button
                              onClick={() => openDeleteConfirmationModal(admin)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors duration-200"
                              disabled={loading}
                            >
                              Odstrániť
                            </button>
                          </>
                        )}
                        {admin.uid === user.uid && (
                          <span className="text-gray-500 text-sm">Vy (Aktuálny admin)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Regular Users Section */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Bežní používatelia</h3>
        {regularUsers.length === 0 ? (
          <p className="text-gray-600">Žiadni bežní používatelia neboli nájdení.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg shadow-md">
              <thead className="bg-gray-200">
                <tr>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">E-mail</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Meno</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Telefón</th>
                  <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {regularUsers.map((regularUser) => (
                  <tr key={regularUser.uid} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-700">{regularUser.email}</td>
                    <td className="py-2 px-4 text-gray-700">{regularUser.displayName || `${regularUser.firstName} ${regularUser.lastName}`}</td>
                    <td className="py-2 px-4 text-gray-700">{regularUser.contactPhoneNumber || '-'}</td>
                    <td className="py-2 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openRoleEditModal(regularUser)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors duration-200"
                          disabled={loading}
                        >
                          Zmeniť rolu
                        </button>
                        <button
                          onClick={() => openDeleteConfirmationModal(regularUser)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors duration-200"
                          disabled={loading}
                        >
                          Odstrániť
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersView;
