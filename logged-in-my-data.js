// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> logged-in-my-data.html
// a GlobalNotificationHandler v header.js spravuje globálnu autentifikáciu a stav používateľa.

// ODSTRÁNENÝ: NotificationModal Component - teraz spravuje header.js
// function NotificationModal({ message, onClose, type = 'info' }) { ... }

// Main React component for the logged-in-my-data.html page
function MyDataApp() {
  // NOVÉ: Získame referencie na Firebase služby priamo
  const app = firebase.app();
  const auth = firebase.auth(app);
  const db = firebase.firestore(app);

  // NOVÉ: Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  // Tieto stavy budú aktualizované lokálnym onAuthStateChanged a onSnapshot
  const [user, setUser] = React.useState(auth.currentUser); // Inicializovať s aktuálnym používateľom
  const [userProfileData, setUserProfileData] = React.useState(null); 

  const [loading, setLoading] = React.useState(true); // Loading pre dáta v MyDataApp
  const [error, setError] = React.useState('');
  // ODSTRÁNENÉ: userNotificationMessage - použijeme window.showGlobalNotification
  // const [userNotificationMessage, setUserNotificationMessage] = React.useState(''); 

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);

  // Zabezpečíme, že appId je definované (používame globálnu premennú)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  // NOVÉ: Lokálny Auth Listener pre MyDataApp
  // Tento listener zabezpečí, že MyDataApp reaguje na zmeny autentifikácie,
  // ale primárne odhlásenie/presmerovanie spravuje GlobalNotificationHandler.
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      console.log("MyDataApp: Lokálny onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
      setUser(currentUser);
      // Ak používateľ nie je prihlásený, presmerujeme ho (aj keď by to mal spraviť GNH)
      if (!currentUser) {
        console.log("MyDataApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });
    return () => unsubscribeAuth();
  }, [auth]); // Závisí od auth inštancie

  // NOVÉ: Lokálny Effect pre načítanie používateľských dát z Firestore
  // Tento efekt sa spustí, keď je používateľ prihlásený a db je k dispozícii.
  // Predpokladá sa, že passwordLastChanged a approved status sú už overené v header.js.
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db) { // Spustí sa len ak je používateľ prihlásený a db je k dispozícii
      console.log(`MyDataApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); // Nastavíme loading na true, kým sa načítajú dáta profilu

      try {
        const userDocRef = db.collection('users').doc(user.uid);
        unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
          if (docSnapshot.exists) {
            const userData = docSnapshot.data();
            console.log("MyDataApp: Používateľský dokument existuje, dáta:", userData);

            // NOVINKA: Aktualizácia emailu vo Firestore, ak sa nezhoduje s Auth emailom
            if (user && user.email && userData.email !== user.email) {
              console.log(`MyDataApp: Detekovaný nesúlad emailov. Firestore: ${userData.email}, Auth: ${user.email}. Aktualizujem Firestore.`);
              userDocRef.update({ email: user.email })
                .then(async () => {
                  console.log("MyDataApp: Email vo Firestore úspešne aktualizovaný na základe Auth emailu.");
                  // Použijeme globálnu notifikáciu
                  if (typeof window.showGlobalNotification === 'function') {
                    window.showGlobalNotification("E-mailová adresa bola úspešne aktualizovaná!");
                  }
                  // NOVINKA: Uloženie notifikácie pre administrátorov do Firestore
                  try {
                      await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('adminNotifications').add({
                          message: `E-mail používateľa ${user.email} bol automaticky aktualizovaný.`,
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

            // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
            if (typeof updateMenuItemsVisibility === 'function') {
                updateMenuItemsVisibility(userData.role);
            } else {
                console.warn("MyDataApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
            }

            console.log("MyDataApp: Načítanie používateľských dát dokončené, loading: false");
          } else {
            console.warn("MyDataApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            // Ak sa profil nenájde, ale používateľ je prihlásený, môže to byť problém. Odhlásime ho.
            setError("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.");
            setLoading(false);
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("MyDataApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
          setLoading(false);
          // Pri chybe odhlásime používateľa, pretože dáta profilu sú kritické
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("MyDataApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
        setLoading(false);
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } else if (user === null) {
        // Ak je user null (a už nie undefined), znamená to, že bol odhlásený.
        // Presmerovanie už by mal spraviť GlobalNotificationHandler.
        // Tu len zabezpečíme, že loading je false a dáta sú vyčistené.
        setLoading(false);
        setUserProfileData(null);
    }


    return () => {
      if (unsubscribeUserDoc) {
        console.log("MyDataApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, auth]); // Závisí od user a db (a auth pre signOut)

  // ODSTRÁNENÉ: useEffect pre aktualizáciu odkazov hlavičky - spravuje header.js
  // React.useEffect(() => { ... }, [user]);

  // ODSTRÁNENÉ: Handle logout - spravuje header.js
  // const handleLogout = React.useCallback(async () => { ... }, [auth]);

  // ODSTRÁNENÉ: Attach logout handler - spravuje header.js
  // React.useEffect(() => { ... }, [handleLogout]);

  // Helper function to format postal code
  const formatPostalCode = (code) => {
    if (code && code.length === 5 && /^\d{5}$/.test(code)) {
      return `${code.substring(0, 3)} ${code.substring(3, 5)}`;
    }
    return code; // Return original if not 5 digits or not numeric
  };

  // Display loading state
  // Zobraz loading, ak user nie je prihlásený, alebo ak sú dáta profilu ešte načítavané
  if (!user || loading) {
    // Ak user nie je prihlásený, presmerovanie už by mal spraviť GlobalNotificationHandler.
    // Tu len zabezpečíme zobrazenie loading správy.
    let loadingMessage = 'Načítavam...';
    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Ak sa dostaneme sem, user je prihlásený a userProfileData by mali byť načítané.
  // Ak userProfileData stále chýbajú, je to chyba, ktorú by mal ošetriť error state.
  if (!userProfileData) {
      return React.createElement(
        'div',
        { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
        React.createElement('div', { className: 'text-xl font-semibold text-red-700' }, error || 'Chyba pri načítaní profilových dát.')
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
    // ODSTRÁNENÉ: Vykreslenie NotificationModal - teraz spravuje header.js
    // React.createElement(NotificationModal, { ... }), 
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
                ` ${userProfileData.email || user.email || ''}`
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
