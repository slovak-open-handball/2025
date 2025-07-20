// js/logged-in-notifications.js

function NotificationsComponent({ setLoading, setError, setMessage, userNotifications, fetchNotifications }) {
  const { user, db } = useAuth(); // Získajte user a db z AuthContext

  const markMessageAsRead = async (messageId) => {
    setLoading(true);
    try {
      await db.collection('messages').doc(messageId).update({ read: true });
      setMessage('Správa označená ako prečítaná.');
      fetchNotifications(user.uid); // Obnoviť notifikácie po aktualizácii
    } catch (err) {
      console.error("Chyba pri označovaní správy ako prečítanej:", err);
      setError("Chyba pri označovaní správy ako prečítanej.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-blue-700 mb-4">Moje Notifikácie</h2>
      {userNotifications.length === 0 ? (
        <p className="text-gray-600 text-center">Nemáte žiadne nové notifikácie.</p>
      ) : (
        <div className="space-y-4">
          {userNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 rounded-lg shadow-md ${
                notification.read === false ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50 border-l-4 border-gray-300'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-gray-800">
                  {notification.type === 'system' ? 'Systémové upozornenie' : `Správa od ${notification.senderEmail || 'Admina'}`}
                </p>
                <span className="text-sm text-gray-500">
                  {notification.timestamp ? notification.timestamp.toDate().toLocaleString() : 'Neznámy čas'}
                </span>
              </div>
              <p className="text-gray-700">{notification.content}</p>
              {notification.type !== 'system' && notification.read === false && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => markMessageAsRead(notification.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors duration-200"
                  >
                    Označiť ako prečítané
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
