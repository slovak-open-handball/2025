// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú teraz definované v <head> index.html
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
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
    }
    // Cleanup function to clear the timer if the component unmounts or message changes
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, onClose]);

  // Render the modal only if 'show' is true
  if (!show) return null;

  return React.createElement(
    'div',
    {
      className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50',
      onClick: onClose, // Close when clicking outside the modal content
    },
    React.createElement(
      'div',
      {
        className: 'bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 relative',
        onClick: (e) => e.stopPropagation(), // Prevent closing when clicking inside modal content
      },
      React.createElement(
        'button',
        {
          onClick: onClose,
          className: 'absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl font-bold',
        },
        '×'
      ),
      React.createElement(
        'p',
        { className: 'text-lg text-gray-800 text-center' },
        message
      )
    )
  );
}

// Main App Component (converted to React.createElement)
function App() {
  // Použitie globálneho hooku pre stav autentifikácie
  const { user, loading, auth, db } = window.useAuthStatus();
  const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
  const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
  const [tournamentName, setTournamentName] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState(null);
  const [showNotificationModal, setShowNotificationModal] = React.useState(false);
  const [countdown, setCountdown] = React.useState(null);

  // Efekt pre načítanie nastavení registrácie
  React.useEffect(() => {
    // Ak je používateľ prihlásený na index.html, NEPRESMIEROVAŤ, len zobraziť obsah
    // Táto stránka je určená ako úvodná stránka pre všetkých, prihlásených aj odhlásených.
    // Ak by sa tu nachádzala logika presmerovania, bola by odstránená.
    if (!loading && user) {
        console.log("Používateľ je prihlásený na index.html. Zostáva na tejto stránke.");
    }

    if (!db) {
      console.warn("Firestore nie je inicializovaný.");
      return;
    }

    const docRef = db.collection('artifacts').doc(window.appId).collection('public').doc('tournamentSettings');

    const unsubscribe = docRef.onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        setTournamentName(data.tournamentName || 'Slovak Open Handball 2025');
        setRegistrationStartDate(data.registrationStartDate ? new Date(data.registrationStartDate) : null);
        setRegistrationEndDate(data.registrationEndDate ? new Date(data.registrationEndDate) : null);
      } else {
        console.log("Dokument 'tournamentSettings' neexistuje.");
        setTournamentName('Slovak Open Handball 2025'); // Predvolené meno
        setRegistrationStartDate(null);
        setRegistrationEndDate(null);
      }
    }, (error) => {
      console.error("Chyba pri načítaní nastavení turnaja:", error);
      setUserNotificationMessage(`Chyba pri načítaní nastavení turnaja: ${error.message}`);
      setShowNotificationModal(true);
    });

    return () => unsubscribe();
  }, [loading, user, db]); // Zmeny v závislostiach

  // Efekt pre odpočítavanie do začiatku registrácie
  React.useEffect(() => {
    let timer;
    if (registrationStartDate && new Date() < registrationStartDate) {
      timer = setInterval(() => {
        const now = new Date();
        const distance = registrationStartDate.getTime() - now.getTime();

        if (distance < 0) {
          clearInterval(timer);
          setCountdown(null);
          // Force re-render to update registration status
          setRegistrationStartDate(new Date(registrationStartDate.getTime()));
        } else {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);
    } else {
      setCountdown(null);
    }

    return () => clearInterval(timer);
  }, [registrationStartDate]);

  const now = new Date();
  const regStart = registrationStartDate ? registrationStartDate.getTime() : null;
  const regEnd = registrationEndDate ? registrationEndDate.getTime() : null;

  const isRegistrationActive = regStart && regEnd && now >= regStart && now <= regEnd;
  const isRegistrationUpcoming = regStart && now < regStart;
  const isRegistrationEnded = regEnd && now > regEnd;

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4' },
    userNotificationMessage && React.createElement(NotificationModal, {
      message: userNotificationMessage,
      onClose: () => {
        setShowNotificationModal(false);
        setUserNotificationMessage(null);
      }
    }),
    React.createElement(
      'div',
      { className: 'bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full text-center' },
      React.createElement(
        'h1',
        { className: 'text-4xl font-bold text-blue-700 mb-4' },
        tournamentName
      ),
      React.createElement(
        'p',
        { className: 'text-xl text-gray-600 mb-8' },
        'Vitajte na oficiálnej stránke Slovak Open Handball 2025!'
      ),
      React.createElement(
        'div',
        { className: 'space-y-4' },
        React.createElement(
          'div',
          { className: 'bg-blue-50 p-6 rounded-lg shadow-md' },
          React.createElement(
            'h2',
            { className: 'text-2xl font-semibold text-blue-600 mb-4' },
            'Stav registrácie'
          ),
          isRegistrationActive ? (
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-green-600 text-lg font-bold' },
                'Registrácia je otvorená!'
              ),
              React.createElement(
                'p',
                { className: 'text-md text-gray-500 mt-2' },
                'Registrácia končí:',
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
              ),
              React.createElement(
                'div',
                { className: 'mt-6 flex justify-center' },
                React.createElement(
                  'a',
                  {
                    href: 'register.html',
                    className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                  },
                  'Registrovať sa'
                )
              )
            )
          ) : isRegistrationUpcoming ? (
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-orange-600 text-lg font-bold' },
                'Registrácia sa ešte nezačala.'
              ),
              React.createElement(
                'p',
                { className: 'text-md text-gray-500 mt-2' },
                'Registrácia začína:',
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleDateString('sk-SK')),
                ' ',
                React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationStartDate).toLocaleTimeString('sk-SK'))
              ),
              countdown && (
                React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
              )
            )
          ) : (
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-red-600 text-lg font-bold' },
                'Registrácia je momentálne zatvorená.'
              ),
              regEnd && !isNaN(regEnd) && now > regEnd && (
                React.createElement(
                  'p',
                  { className: 'text-md text-gray-500 mt-2' },
                  'Registrácia skončila:',
                  ' ',
                  React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
                  ' ',
                  React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
                )
              )
            )
          ),
          // Vždy zobraziť tlačidlo Prihlásenie, bez ohľadu na stav registrácie
          React.createElement(
            'div',
            { className: 'mt-6 flex justify-center' },
            React.createElement(
              'a',
              {
                href: 'login.html',
                className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
              },
              'Prihlásenie'
            )
          )
        )
      )
    )
  );
}
