// logged-in-my-data.js

// Predpokladáme, že tieto funkcie sú definované inde alebo sú súčasťou tohto súboru
// Komponenta pre vstup hesla s prepínaním viditeľnosti
function PasswordInput({ id, label, value, onChange, placeholder, autoComplete, showPassword, toggleShowPassword, onCopy, onPaste, onCut, disabled, description }) {
  const EyeIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.51 9.963 7.322.034.139.034.279 0 .418A10.05 10.05 0 0112 19c-4.638 0-8.573-2.51-9.963-7.322zM15 12a3 3 0 11-6 0 3 3 0 016 0z' })
  );

  const EyeOffIcon = React.createElement(
    'svg',
    { className: 'h-5 w-5 text-gray-500', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7a9.95 9.95 0 011.875.175m.001 0V5m0 14v-2.175m0-10.65L12 12m-6.25 6.25L12 12m0 0l6.25-6.25M12 12l-6.25-6.25' })
  );

  return React.createElement(
    'div',
    { className: 'relative' },
    React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: id }, label),
    React.createElement('input', {
      type: showPassword ? 'text' : 'password',
      id: id,
      className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 pr-10',
      value: value,
      onChange: onChange,
      onCopy: (e) => e.preventDefault(),
      onPaste: (e) => e.preventDefault(),
      onCut: (e) => e.preventDefault(),
      required: true,
      placeholder: placeholder,
      autoComplete: autoComplete,
      disabled: disabled,
    }),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: toggleShowPassword,
        className: 'absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5',
        disabled: disabled,
      },
      showPassword ? EyeOffIcon : EyeIcon
    ),
    description && React.createElement(
      'p',
      { className: 'text-gray-600 text-sm -mt-2' },
      description
    )
  );
}

// Komponenta pre zobrazenie notifikácií
function NotificationModal({ message, onClose }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    if (message) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message, onClose]);

  if (!show && !message) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}


// Hlavná React komponenta pre stránku prihláseného používateľa
function LoggedInApp() {
  // Používame useAuthStatus hook z firebase-init.js
  const { user, loading, error, auth, db } = window.useAuthStatus();

  const [users, setUsers] = React.useState([]);
  const [userToEditRole, setUserToEditRole] = React.useState(null);
  const [newRole, setNewRole] = React.useState('user');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');
  const [localError, setLocalError] = React.useState(''); // Pre chyby špecifické pre tento komponent

  // Efekt pre načítanie používateľov (spustí sa, keď je DB inicializovaná a používateľ prihlásený)
  React.useEffect(() => {
    if (!db || !user) {
      // Čakajte, kým sa DB inicializuje a používateľ je prihlásený
      return;
    }

    // Ak je používateľ prihlásený, ale nemá rolu, skontrolujte rolu v Firestore
    const fetchUserRole = async () => {
      if (user && user.uid) {
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            // Ak používateľ nemá platnú rolu alebo nie je schválený, presmerujte ho
            if (!userData.role || (userData.role !== 'admin' && userData.role !== 'user') || userData.approved === false) {
              console.warn("LoggedInApp: Používateľ nemá platnú rolu alebo nie je schválený. Odhlasujem a presmerujem.");
              await auth.signOut();
              window.location.href = 'login.html';
            }
          } else {
            // Ak používateľský dokument neexistuje, odhláste ho
            console.warn("LoggedInApp: Používateľský dokument neexistuje. Odhlasujem a presmerujem.");
            await auth.signOut();
            window.location.href = 'login.html';
          }
        } catch (e) {
          console.error("LoggedInApp: Chyba pri kontrole roly používateľa:", e);
          setLocalError(`Chyba pri kontrole roly používateľa: ${e.message}`);
          await auth.signOut();
          window.location.href = 'login.html';
        }
      }
    };

    fetchUserRole();

    // Poslucháč pre zmeny v kolekcii 'users'
    const unsubscribe = db.collection('users').onSnapshot(snapshot => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, err => {
      console.error("LoggedInApp: Chyba pri načítaní používateľov z Firestore:", err);
      setLocalError(`Chyba pri načítaní používateľov: ${err.message}`);
    });

    return () => unsubscribe(); // Odhlásenie poslucháča pri odpojení komponentu
  }, [db, user, auth]); // Závisí od db a user

  const handleUpdateUserRole = async () => {
    if (!db || !userToEditRole) return;
    setLocalError('');
    try {
      await db.collection('users').doc(userToEditRole.id).update({ role: newRole });
      setUserNotificationMessage(`Rola používateľa ${userToEditRole.email} bola úspešne aktualizovaná na ${newRole}.`);
      closeRoleEditModal();
    } catch (e) {
      console.error("LoggedInApp: Chyba pri aktualizácii roly používateľa:", e);
      setLocalError(`Chyba pri aktualizácii roly: ${e.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!db || !auth) return;

    // Zobrazenie potvrdzovacieho dialógu
    const isConfirmed = window.confirm("Naozaj chcete vymazať tohto používateľa? Túto akciu nie je možné vrátiť späť.");
    if (!isConfirmed) {
        return; // Ak používateľ zruší, nič nerobte
    }

    setLocalError('');
    try {
      // Najprv vymažeme používateľa z Firestore
      await db.collection('users').doc(userId).delete();
      setUserNotificationMessage("Používateľ bol úspešne vymazaný z databázy.");

      console.warn("LoggedInApp: Používateľ bol vymazaný z Firestore. Pre úplné vymazanie z Firebase Authentication je potrebné použiť Cloud Functions alebo podobný serverový prístup.");

    } catch (e) {
      console.error("LoggedInApp: Chyba pri mazaní používateľa:", e);
      setLocalError(`Chyba pri mazaní používateľa: ${e.message}`);
    }
  };

  const openRoleEditModal = (user) => {
    setUserToEditRole(user);
    setNewRole(user.role);
  };

  const closeRoleEditModal = () => {
    setUserToEditRole(null);
    setNewRole('user');
  };

  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("LoggedInApp: Chyba pri odhlásení:", e);
      setLocalError(`Chyba pri odhlásení: ${e.message}`);
    }
  }, [auth]);

  // Pripojenie handleLogout k tlačidlu "Odhlásenie" v hlavičke
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  // Zobrazenie načítavacieho stavu
  if (loading || user === undefined) {
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, 'Načítavam...')
    );
  }

  // Ak používateľ nie je prihlásený (a načítanie je dokončené), presmerujeme ho
  if (!user && !loading) {
    // Presmerovanie sa už deje v useAuthStatus hooku, ale pre istotu
    window.location.href = 'login.html';
    return null;
  }

  // Získanie roly aktuálneho používateľa
  const currentUserData = users.find(u => u.id === user?.uid);
  const isCurrentUserAdmin = currentUserData?.role === 'admin';

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, { message: userNotificationMessage, onClose: () => setUserNotificationMessage('') }),
    React.createElement(
      'div',
      { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        (localError || error) && React.createElement( // Zobrazenie chýb z hooku aj lokálnych chýb
          'div',
          { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
          localError || error
        ),
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' }, 'Moja Zóna'),
        user && React.createElement(
          'div',
          { className: 'mb-6 text-center text-gray-700' },
          React.createElement('p', { className: 'text-lg font-semibold' }, `Vitajte, ${currentUserData?.displayName || user.email}!`),
          isCurrentUserAdmin && React.createElement('p', { className: 'text-md text-blue-600' }, '(Administrátor)')
        ),

        // Sekcia pre správu používateľov (len pre administrátorov)
        isCurrentUserAdmin && React.createElement(
          'div',
          { className: 'mt-8' },
          React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, 'Správa používateľov'),
          React.createElement(
            'div',
            { className: 'overflow-x-auto' },
            React.createElement(
              'table',
              { className: 'min-w-full bg-white rounded-lg shadow overflow-hidden' },
              React.createElement(
                'thead',
                { className: 'bg-gray-200' },
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', { className: 'py-3 px-4 text-left text-sm font-semibold text-gray-600' }, 'E-mail'),
                  React.createElement('th', { className: 'py-3 px-4 text-left text-sm font-semibold text-gray-600' }, 'Meno'),
                  React.createElement('th', { className: 'py-3 px-4 text-left text-sm font-semibold text-gray-600' }, 'Rola'),
                  React.createElement('th', { className: 'py-3 px-4 text-left text-sm font-semibold text-gray-600' }, 'Schválený'),
                  React.createElement('th', { className: 'py-3 px-4 text-left text-sm font-semibold text-gray-600' }, 'Akcie')
                )
              ),
              React.createElement(
                'tbody',
                null,
                users.map(u => (
                  React.createElement(
                    'tr',
                    { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-50' },
                    React.createElement('td', { className: 'py-3 px-4 text-sm text-gray-800' }, u.email),
                    React.createElement('td', { className: 'py-3 px-4 text-sm text-gray-800' }, `${u.firstName || ''} ${u.lastName || ''}`),
                    React.createElement('td', { className: 'py-3 px-4 text-sm text-gray-800' }, u.role),
                    React.createElement('td', { className: 'py-3 px-4 text-sm text-gray-800' }, u.approved ? 'Áno' : 'Nie'),
                    React.createElement(
                      'td',
                      { className: 'py-3 px-4 text-sm' },
                      React.createElement(
                        'button',
                        {
                          onClick: () => openRoleEditModal(u),
                          className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-xs mr-2 transition-colors duration-200',
                        },
                        'Upraviť rolu'
                      ),
                      React.createElement(
                        'button',
                        {
                          onClick: () => handleDeleteUser(u.id),
                          className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-colors duration-200',
                        },
                        'Vymazať'
                      )
                    )
                  )
                ))
              )
            )
          )
        ),

        // Modálne okno pre úpravu roly
        userToEditRole && React.createElement(
          'div',
          { className: 'modal' },
          React.createElement(
            'div',
            { className: 'modal-content' },
            React.createElement('h3', { className: 'text-xl font-bold text-gray-800 mb-4' }, `Upraviť rolu pre ${userToEditRole?.email}`),
            React.createElement(
              'div',
              { className: 'mb-4' },
              React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'new-user-role' }, 'Nová rola'),
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
                  // Používame loading stav z useAuthStatus pre disabled
                  disabled: loading,
                },
                loading ? 'Ukladám...' : 'Uložiť'
              )
            )
          )
        )
      )
    )
  );
}

// Export hlavného komponentu pre rendering v HTML
window.LoggedInApp = LoggedInApp;
