function NotificationsView({
  user,
  db,
  appId,
  isAdmin,
  loading,
  setError,
  setUserNotificationMessage,
  userNotifications, // Array of notifications from App.js
  dismissNotification, // Function to dismiss a single notification
  markMessageAsRead, // Function to mark a message as read
  handleClearNotifications // Function to clear all notifications
}) {

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h2 className="text-xl font-semibold text-gray-800">Moje upozornenia a správy</h2>
      {userNotifications.length === 0 ? (
        <p className="text-gray-600">Nemáte žiadne nové upozornenia ani správy.</p>
      ) : (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={handleClearNotifications}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
              disabled={loading}
            >
              Vymazať všetky
            </button>
          </div>
          <ul className="space-y-4">
            {userNotifications.map(notification => (
              <li key={notification.id} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800">
                    {notification.type === 'system_alert' ? 'Systémové upozornenie' : `Správa od ${notification.senderName || 'Neznámy odosielateľ'}`}
                  </h3>
                  <button
                    onClick={() => dismissNotification(notification.id, notification.type, notification.collection)}
                    className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    title="Vymazať upozornenie"
                    disabled={loading}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {notification.type === 'direct_message' && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Predmet:</span> {notification.subject}
                  </p>
                )}
                <p className="text-gray-700 mb-2 whitespace-pre-wrap">{notification.message || notification.content}</p>
                <p className="text-xs text-gray-500">
                  {notification.timestamp?.toDate().toLocaleString('sk-SK') || 'Neznámy dátum'}
                </p>
                {notification.type === 'direct_message' && !notification.readBy?.includes(user.uid) && (
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => markMessageAsRead(notification.id)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors duration-200"
                      disabled={loading}
                    >
                      Označiť ako prečítané
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default NotificationsView;
