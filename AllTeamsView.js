function AllTeamsView({ allUsersData }) {
  // Filter for regular users (role 'user') as they represent teams/clubs
  const teams = allUsersData.filter(user => user.role === 'user');

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Všetky tímy (registrácie)</h2>
      {teams.length === 0 ? (
        <p className="text-gray-600">Žiadne tímy neboli zatiaľ zaregistrované.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg shadow-md">
            <thead className="bg-gray-200">
              <tr>
                <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Názov tímu / Meno kontaktnej osoby</th>
                <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">E-mail</th>
                <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Telefón</th>
                <th className="py-2 px-4 text-left text-gray-600 font-bold uppercase text-sm">Dátum registrácie</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.uid} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2 px-4 text-gray-700">{team.displayName || `${team.firstName} ${team.lastName}`}</td>
                  <td className="py-2 px-4 text-gray-700">{team.email}</td>
                  <td className="py-2 px-4 text-gray-700">{team.contactPhoneNumber || '-'}</td>
                  <td className="py-2 px-4 text-gray-700">
                    {team.registeredAt?.toDate().toLocaleDateString('sk-SK') || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AllTeamsView;
