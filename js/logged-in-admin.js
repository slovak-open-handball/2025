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
      // MODIFIKOVANÉ: Prístup k nastaveniam cez cestu artifacts
      const settingsDoc = await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('settings').doc('registration').get();
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
    // Použite vlastný modálny dialóg namiesto window.confirm
    const confirmed = await new Promise(resolve => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Potvrdenie zmazania</h3>
                <p class="mb-4">Naozaj chcete zmazať tohto užívateľa? Táto akcia je nevratná.</p>
                <div class="flex justify-end space-x-4">
                    <button id="cancelDelete" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200">Zrušiť</button>
                    <button id="confirmDelete" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200">Zmazať</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancelDelete').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
        document.getElementById('confirmDelete').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
    });


    if (confirmed) {
      setLoading(true);
      setMessage('');
      setError('');
      try {
        await db.collection('users').doc(userId).delete();
        // auth.deleteUser(userId); // Toto je možné len ak beží na serveri cez Admin SDK.
                                // Pre klientskú stranu to zlyhá, pokiaľ sa používateľ nereautentifikuje.
                                // V reálnej aplikácii by to mala byť Firebase funkcia.
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

      // MODIFIKOVANÉ: Odosielanie správ cez cestu artifacts
      await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('messages').add({
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
      // Spustenie načítania notifikácií pre príjemcu, ak je momentálne prihlásený
      // Toto je zložité na strane klienta, ideálne spracované prostredníctvom real-time listenerov alebo cloud funkcií
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
      // MODIFIKOVANÉ: Aktualizácia nastavení cez cestu artifacts
      await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('settings').doc('registration').set({
        startDate: registrationStart ? firebase.firestore.Timestamp.fromDate(new Date(registrationStart)) : null,
        endDate: registrationEnd ? firebase.firestore.Timestamp.fromDate(new Date(registrationEnd)) : null,
        userDataEditEndDate: dataEditEnd ? firebase.firestore.Timestamp.fromDate(new Date(dataEditEnd)) : null,
      }, { merge: true }); // Použite merge, aby ste prepísali ostatné nastavenia
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
      fetchUsers(); // Obnoviť zoznam užívateľov
      closeRoleEditModal();
    } catch (err) {
      console.error("Chyba pri zmene roly užívateľa:", err);
      setError("Chyba pri zmene roly užívateľa.");
    } finally {
      setLoading(false);
    }
  };


  if (!isAdmin) {
    return React.createElement(
      'div',
      { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative', role: 'alert' },
      React.createElement('strong', { className: 'font-bold' }, 'Prístup zamietnutý!'),
      React.createElement('span', { className: 'block sm:inline' }, ' Nemáte oprávnenie na prístup k admin panelu.')
    );
  }

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-lg' },
    React.createElement(
      'h2',
      { className: 'text-2xl font-semibold text-blue-700 mb-4' },
      'Admin Panel'
    ),
    React.createElement(
      'section',
      { className: 'mb-8' },
      React.createElement(
        'h3',
        { className: 'text-xl font-semibold text-gray-800 mb-3' },
        'Správa užívateľov'
      ),
      React.createElement(
        'div',
        { className: 'overflow-x-auto' },
        React.createElement(
          'table',
          { className: 'min-w-full bg-white border border-gray-200 rounded-lg' },
          React.createElement(
            'thead',
            null,
            React.createElement(
              'tr',
              { className: 'bg-gray-100' },
              React.createElement('th', { className: 'py-2 px-4 border-b' }, 'Email'),
              React.createElement('th', { className: 'py-2 px-4 border-b' }, 'Rola'),
              React.createElement('th', { className: 'py-2 px-4 border-b' }, 'Akcie')
            )
          ),
          React.createElement(
            'tbody',
            null,
            users.map((u) =>
              React.createElement(
                'tr',
                { key: u.id, className: 'hover:bg-gray-50' },
                React.createElement('td', { className: 'py-2 px-4 border-b' }, u.email),
                React.createElement('td', { className: 'py-2 px-4 border-b' }, u.role),
                React.createElement(
                  'td',
                  { className: 'py-2 px-4 border-b' },
                  React.createElement(
                    'button',
                    {
                      onClick: () => openRoleEditModal(u),
                      className: 'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm mr-2',
                      disabled: user.uid === u.id, // Nemôžete zmeniť vlastnú rolu
                    },
                    'Upraviť rolu'
                  ),
                  React.createElement(
                    'button',
                    {
                      onClick: () => handleDeleteUser(u.id),
                      className: 'bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm',
                      disabled: user.uid === u.id, // Nemôžete zmazať samého seba
                    },
                    'Zmazať'
                  )
                )
              )
            )
          )
        )
      )
    ),
    React.createElement(
      'section',
      { className: 'mb-8' },
      React.createElement(
        'h3',
        { className: 'text-xl font-semibold text-gray-800 mb-3' },
        'Odoslať správu užívateľovi'
      ),
      React.createElement(
        'form',
        { onSubmit: handleSendMessage },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'recipient-email' },
            'Príjemca'
          ),
          React.createElement(
            'select',
            {
              id: 'recipient-email',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
              value: selectedUserEmail,
              onChange: (e) => setSelectedUserEmail(e.target.value),
              required: true,
            },
            React.createElement('option', { value: '' }, 'Vyberte užívateľa'),
            users.map((u) =>
              React.createElement('option', { key: u.id, value: u.email }, u.email)
            )
          )
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'message-content' },
            'Obsah správy'
          ),
          React.createElement('textarea', {
            id: 'message-content',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline h-32 resize-y',
            placeholder: 'Napíšte správu...',
            value: messageContent,
            onChange: (e) => setMessageContent(e.target.value),
            required: true,
          })
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200',
              disabled: loading,
            },
            'Odoslať správu'
          )
        )
      )
    ),
    React.createElement(
      'section',
      null,
      React.createElement(
        'h3',
        { className: 'text-xl font-semibold text-gray-800 mb-3' },
        'Nastavenia Dátumov'
      ),
      React.createElement(
        'form',
        { onSubmit: handleUpdateSettings },
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-start' },
            'Začiatok registrácie'
          ),
          React.createElement('input', {
            type: 'datetime-local',
            id: 'reg-start',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            value: registrationStart,
            onChange: (e) => setRegistrationStart(e.target.value),
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-end' },
            'Koniec registrácie'
          ),
          React.createElement('input', {
            type: 'datetime-local',
            id: 'reg-end',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            value: registrationEnd,
            onChange: (e) => setRegistrationEnd(e.target.value),
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement(
            'label',
            { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'data-edit-end' },
            'Koniec úpravy dát užívateľa'
          ),
          React.createElement('input', {
            type: 'datetime-local',
            id: 'data-edit-end',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline',
            value: dataEditEnd,
            onChange: (e) => setDataEditEnd(e.target.value),
          })
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            'button',
            {
              type: 'submit',
              className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200',
              disabled: loading,
            },
            'Uložiť nastavenia'
          )
        )
      )
    ),
    isRoleEditModalOpen &&
      React.createElement(
        'div',
        { className: 'modal' },
        React.createElement(
          'div',
          { className: 'modal-content' },
          React.createElement(
            'h3',
            { className: 'text-xl font-bold mb-4' },
            'Upraviť rolu pre ',
            userToEditRole?.email
          ),
          React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement(
              'label',
              { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-user-role' },
              'Nová rola'
            ),
            React.createElement(
              'select',
              {
                id: 'new-user-role',
                className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
                value: newRole,
                onChange: (e) => setNewRole(e.target.value),
              },
              React.createElement('option', { value: 'user' }, 'Používateľ'),
              React.createElement('option', { value: 'admin' }, 'Administrátor')
            )
          ),
          React.createElement(
            'div',
            { className: 'flex justify-end space-x-4' },
            React.createElement(
              'button',
              {
                onClick: closeRoleEditModal,
                className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors duration-200',
              },
              'Zrušiť'
            ),
            React.createElement(
              'button',
              {
                onClick: handleUpdateUserRole,
                className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200',
                disabled: loading,
              },
              loading ? 'Ukladám...' : 'Uložiť'
            )
          )
        )
      )
  );
}
