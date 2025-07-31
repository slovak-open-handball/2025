// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  // Získame referencie na Firebase služby a globálne dáta z authentication.js
  const auth = window.auth;
  const db = window.db;

  // Lokálny stav pre používateľské dáta, ktoré sa načítavajú po globálnej autentifikácii
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [loading, setLoading] = React.useState(true); // Loading pre dáta v MyDataApp
  const [error, setError] = React.useState('');

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, až keď je globálna autentifikácia pripravená.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
    if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
      console.log(`MyDataApp: Globálna autentifikácia pripravená. Pokúšam sa načítať používateľský dokument pre UID: ${auth.currentUser.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = db.collection('users').doc(auth.currentUser.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);

            // Aktualizácia emailu vo Firestore, ak sa nezhoduje s Auth emailom
            if (auth.currentUser && auth.currentUser.email && userData.email !== auth.currentUser.email) {
              console.log(`MyDataApp: Detekovaný nesúlad emailov. Firestore: ${userData.email}, Auth: ${auth.currentUser.email}. Aktualizujem Firestore.`);
              userDocRef.update({ email: auth.currentUser.email })
                .then(async () => {
                  console.log("MyDataApp: Email vo Firestore úspešne aktualizovaný na základe Auth emailu.");
                  // Použijeme globálnu notifikáciu
                  if (typeof window.showGlobalNotification === 'function') {
                    window.showGlobalNotification("E-mailová adresa bola úspešne aktualizovaná!");
                  }
                  // Uloženie notifikácie pre administrátorov do Firestore
                  try {
                      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                          message: `E-mail používateľa ${auth.currentUser.email} bol automaticky aktualizovaný.`,
                          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                          recipientId: 'all_admins', // Notifikácia pre všetkých administrátorov
                          read: false
                      });
                      console.log("MyDataApp: Notifikácia o automatickej aktualizácii e-mailu pre adminov úspešne uložená do Firestore.");
                  } catch (notificationError) {
                      console.error("MyDataApp: Chyba pri ukladaní notifikácie pre adminov o zmene e-mailu:", notificationError);
                  }
                })
                .catch(updateError => {
                  console.error("MyDataApp: Chyba pri aktualizácii emailu vo Firestore:", updateError);
                });
            }

            setUserProfileData(userData); // Aktualizujeme stav userProfileData
            setLoading(false); // Stop loading po načítaní používateľských dát
            setError(''); // Vymazať chyby po úspešnom načítaní

          } else {
            console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", auth.currentUser.uid);
            setError("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.");
            setLoading(false);
          }
        }, error => {
          console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          setLoading(false);
        });
      } catch (e) {
        console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        setLoading(false);
      }
    } else if (window.isGlobalAuthReady && (!auth || !auth.currentUser)) {
        // Ak je globálna autentifikácia pripravená, ale používateľ nie je prihlásený (alebo auth nie je nastavené)
        setLoading(false);
        setUserProfileData(null);
        console.log("MyDataApp: Globálna autentifikácia pripravená, ale používateľ nie je prihlásený.");
        // Presmerovanie na login.html by mal spraviť AuthenticationManager
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [window.isGlobalAuthReady, db, auth, appId]); // Závisí od globálnych stavov a firebase inštancií

  // Helper function to format postal code
  const formatPostalCode = (code) => {
    if (code && code.length === 5 && /^\d{5}$/.test(code)) {
      return `${code.substring(0, 3)} ${code.substring(3, 5)}`;
    }
    return code; // Return original if not 5 digits or not numeric
  };

  // Display loading state
  // Zobraz loading, kým nie je globálna autentifikácia pripravená alebo kým sa načítavajú dáta profilu
  if (!window.isGlobalAuthReady || loading) {
    let loadingMessage = 'Načítavam...';
    if (!window.isGlobalAuthReady) {
        loadingMessage = 'Inicializujem autentifikáciu...';
    } else if (loading) {
        loadingMessage = 'Načítavam vaše údaje...';
    }
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Ak sa dostaneme sem, globálna autentifikácia je pripravená a používateľ je prihlásený.
  // Ak userProfileData stále chýbajú, je to chyba.
  if (!userProfileData) {
      return React.createElement(
        'div',
        { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
        React.createElement('div', { className: 'text-xl font-semibold text-red-700' }, error || 'Chyba pri načítaní profilových dát. Skúste sa znova prihlásiť.')
      );
  }

  const street = userProfileData.street || '';
  const houseNumber = userProfileData.houseNumber || '';
  const city = userProfileData.city || '';
  const postalCode = userProfileData.postalCode || '';
  const country = userProfileData.country || '';

  const formattedPostalCode = formatPostalCode(postalCode);

  const fullAddress = `${street} ${houseNumber}, ${formattedPostalCode} ${city}, ${country}`.trim();

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage('')
    }),
    React.createElement(
      'div',
      { className: 'w-full px-4 mt-20 mb-10' }, 
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl' }, 
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Moje údaje' 
        ),
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div', 
            { className: 'space-y-2' }, 
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                    ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                )
            ),
            userProfileData.role === 'user' && React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                ` ${userProfileData.contactPhoneNumber || ''}`
              )
            ),
            React.createElement(
              'div',
              null,
              React.createElement(
                'p',
                { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                ` ${userProfileData.email || auth.currentUser.email || ''}`
              )
            ),
            userProfileData.role === 'user' && userProfileData.billing && React.createElement(
              React.Fragment,
              null,
              React.createElement('hr', { className: 'my-6 border-gray-300' }), 
              React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mt-8 mb-4' }, 'Fakturačné údaje'),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                userProfileData.billing.clubName && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'Názov klubu:'), 
                    ` ${userProfileData.billing.clubName}`
                  )
                ),
                fullAddress && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'Adresa:'),
                    ` ${fullAddress}`
                  )
                ),
                userProfileData.billing.ico && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billing.ico}`
                  )
                ),
                userProfileData.billing.dic && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billing.dic}`
                  )
                ),
                userProfileData.billing.icDph && React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg whitespace-nowrap' }, 
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billing.icDph}`
                  )
                )
              )
            )
          ),
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
