// js/logged-in-admin.js

function AdminPanelComponent({ setLoading, setError, setMessage }) {
  const { user, db, isAdmin, isAuthReady, isRoleLoaded, fetchNotifications } = useAuth();
  const [users, setUsers] = React.useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = React.useState('');
  const [messageContent, setMessageContent] = React.useState('');
  const [registrationStart, setRegistrationStart] = React.useState('');
  const [registrationEnd, setRegistrationEnd] = React.useState('');
  const [dataEditEnd, setDataEditEnd] = React.useState('');

  const [isRoleEditModalOpen, setIsRoleEditModalOpen] = React.useState(false);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('user');

  React.useEffect(() => {
    if (isAuthReady && user && isAdmin && db) {
      fetchUsers();
      fetchAdminSettings();
    }
  }, [user, isAdmin, db, isAuthReady]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await db.collection('users').get();
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (err) {
      console.error("Chyba pri načítavaní užívateľov:", err);
      setError("Chyba pri načítavaní užívateľov.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminSettings = async () => {
    setLoading(true);
    try {
      const settingsDoc = await db.collection('settings').doc('registration').get();
      if (settingsDoc.exists) {
        const data = settingsDoc.data();
        setRegistrationStart(data.startDate ? formatToDatetimeLocal(data.startDate.toDate()) : '');
        setRegistrationEnd(data.endDate ? formatToDatetimeLocal(data.endDate.toDate()) : '');
        setDataEditEnd(data.userDataEditEndDate ? formatToDatetimeLocal(data.userDataEditEndDate.toDate()) : '');
      }
    } catch (err) {
      console.error("Chyba pri načítavaní nastavení admina:", err);
      setError("Chyba pri načítavaní nastavení.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Naozaj chcete zmazať tohto užívateľa? Táto akcia je nevratná.')) {
      setLoading(true);
      setMessage('');
      setError('');
      try {
        await db.collection('users').doc(userId).delete();
        await auth.deleteUser(userId); // This is only possible if running on a server via Admin SDK.
                                        // For client-side, this will fail unless user reauthenticates.
                                        // In a real app, this should be a Firebase Function.
        setMessage('Užívateľ bol úspešne zmazaný.');
        fetchUsers();
      } catch (err) {
        console.error("Chyba pri mazaní užívateľa:", err);
        setError(`Chyba pri mazaní užívateľa: ${err.message}. Pre úplné zmazanie môže byť potrebná funkcia na strane servera.`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (!selectedUserEmail || !messageContent) {
      setError('Prosím vyberte užívateľa a napíšte správu.');
      setLoading(false);
      return;
    }

    try {
      const recipient = users.find(u => u.email === selectedUserEmail);
      if (!recipient) {
        setError('Vybraný užívateľ nebol nájdený.');
        setLoading(false);
        return;
      }

      await db.collection('messages').add({
        recipientId: recipient.id,
        senderId: user.uid, // Admin's UID
        senderEmail: user.email,
        content: messageContent,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      setMessage('Správa bola úspešne odoslaná.');
      setMessageContent('');
      setSelectedUserEmail('');
      // Trigger notification fetch for the recipient if they are currently logged in
      // This is complex for client-side, ideally handled by real-time listeners or cloud functions
    } catch (err) {
      console.error("Chyba pri odosielaní správy:", err);
      setError("Chyba pri odosielaní správy.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await db.collection('settings').doc('registration').set({
        startDate: registrationStart ? firebase.firestore.Timestamp.fromDate(new Date(registrationStart)) : null,
        endDate: registrationEnd ? firebase.firestore.Timestamp.fromDate(new Date(registrationEnd)) : null,
        userDataEditEndDate: dataEditEnd ? firebase.firestore.Timestamp.fromDate(new Date(dataEditEnd)) : null,
      }, { merge: true }); // Use merge to avoid overwriting other settings
      setMessage('Nastavenia boli úspešne aktualizované.');
    } catch (err) {
      console.error("Chyba pri aktualizácii nastavení:", err);
      setError("Chyba pri aktualizácii nastavení.");
    } finally {
      setLoading(false);
    }
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role);
    setIsRoleEditModalOpen(true);
  };

  const closeRoleEditModal = () => {
    setIsRoleEditModalOpen(false);
    setUserToEditRole(null);
    setNewRole('user');
  };

  const handleUpdateUserRole = async () => {
    if (!userToEditRole) return;
    setLoading(true);
    setMessage('');
    setError('');

    try {
      await db.collection('users').doc(userToEditRole.id).update({
        role: newRole,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setMessage(`Rola pre ${userToEditRole.email} bola úspešne zmenená na ${newRole}.`);
      fetchUsers(); // Refresh user list
      closeRoleEditModal();
    } catch (err) {
      console.error("Chyba pri zmene roly užívateľa:", err);
      setError("Chyba pri zmene roly užívateľa.");
    } finally {
      setLoading(false);
    }
  };


  if (!isAdmin) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Prístup zamietnutý!</strong>
        <span className="block sm:inline"> Nemáte oprávnenie na prístup k admin panelu.</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-blue-700 mb-4">Admin Panel</h2>

      <section className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">Správa užívateľov</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border-b">Email</th>
                <th className="py-2 px-4 border-b">Rola</th>
                <th className="py-2 px-4 border-b">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{u.email}</td>
                  <td className="py-2 px-4 border-b">{u.role}</td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => openRoleEditModal(u)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2"
                      disabled={user.uid === u.id} // Cannot change own role
                    >
                      Upraviť rolu
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                      disabled={user.uid === u.id} // Cannot delete self
                    >
                      Zmazať
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">Odoslať správu užívateľovi</h3>
        <form onSubmit={handleSendMessage}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="recipient-email">Príjemca</label>
            <select
              id="recipient-email"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={selectedUserEmail}
              onChange={(e) => setSelectedUserEmail(e.target.value)}
              required
            >
              <option value="">Vyberte užívateľa</option>
              {users.map(u => (
                <option key={u.id} value={u.email}>{u.email}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="message-content">Obsah správy</label>
            <textarea
              id="message-content"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32 resize-y"
              placeholder="Napíšte správu..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              required
            ></textarea>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              disabled={loading}
            >
              Odoslať správu
            </button>
          </div>
        </form>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-gray-800 mb-3">Nastavenia Dátumov</h3>
        <form onSubmit={handleUpdateSettings}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-start">Začiatok registrácie</label>
            <input
              type="datetime-local"
              id="reg-start"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={registrationStart}
              onChange={(e) => setRegistrationStart(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="reg-end">Koniec registrácie</label>
            <input
              type="datetime-local"
              id="reg-end"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={registrationEnd}
              onChange={(e) => setRegistrationEnd(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="data-edit-end">Koniec úpravy dát užívateľa</label>
            <input
              type="datetime-local"
              id="data-edit-end"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={dataEditEnd}
              onChange={(e) => setDataEditEnd(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              disabled={loading}
            >
              Uložiť nastavenia
            </button>
          </div>
        </form>
      </section>

      {/* Role Edit Modal */}
      {isRoleEditModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h3 className="text-xl font-bold mb-4">Upraviť rolu pre {userToEditRole?.email}</h3>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="new-user-role">Nová rola</label>
              <select
                id="new-user-role"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="user">Používateľ</option>
                <option value="admin">Administrátor</option>
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={closeRoleEditModal}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200"
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
      )}
    </div>
  );
}
