// js/logged-in-notifications.js

function NotificationsComponent({ setLoading, setError, setMessage, userNotifications, fetchNotifications }) {
  const { user, db } = useAuth(); // Získajte user a db z AuthContext

  const markMessageAsRead = async (messageId) => {
    setLoading(true);
    try {
      // MODIFIKOVANÉ: Prístup k správam cez cestu artifacts
      await db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('messages').doc(messageId).update({ read: true });
      setMessage('Správa označená ako prečítaná.');
      fetchNotifications(user.uid); // Obnoviť notifikácie po aktualizácii
    } catch (err) {
      console.error("Chyba pri označovaní správy ako prečítanej:", err);
      setError("Chyba pri označovaní správy ako prečítanej.");
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-lg' },
    React.createElement(
      'h2',
      { className: 'text-2xl font-semibold text-blue-700 mb-4' },
      'Moje Notifikácie'
    ),
    userNotifications.length === 0 ?
      React.createElement(
        'p',
        { className: 'text-gray-600 text-center' },
        'Nemáte žiadne nové notifikácie.'
      ) :
      React.createElement(
        'div',
        { className: 'space-y-4' },
        userNotifications.map((notification) =>
          React.createElement(
            'div',
            {
              key: notification.id,
              className: `p-4 rounded-lg shadow-md ${
                notification.read === false ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50 border-l-4 border-gray-300'
              }`,
            },
            React.createElement(
              'div',
              { className: 'flex justify-between items-center mb-2' },
              React.createElement(
                'p',
                { className: 'font-semibold text-gray-800' },
                notification.type === 'system' ? 'Systémové upozornenie' : `Správa od ${notification.senderEmail || 'Admina'}`
              ),
              React.createElement(
                'span',
                { className: 'text-sm text-gray-500' },
                notification.timestamp ? notification.timestamp.toDate().toLocaleString() : 'Neznámy čas'
              )
            ),
            React.createElement('p', { className: 'text-gray-700' }, notification.content),
            notification.type !== 'system' && notification.read === false &&
              React.createElement(
                'div',
                { className: 'flex justify-end mt-2' },
                React.createElement(
                  'button',
                  {
                    onClick: () => markMessageAsRead(notification.id),
                    className: 'px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors duration-200',
                  },
                  'Označiť ako prečítané'
                )
              )
          )
        )
      )
  );
}
