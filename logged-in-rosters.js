// logged-in-rosters.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
// Ponechané pre prípad, že by si v budúcnosti potreboval interakciu s Firestore alebo Auth.
import { getFirestore, doc, onSnapshot, setDoc, collection, addDoc, getDoc, deleteField, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Presunutá sem z logged-in-my-data.js pre nezávislosť štýlovania.
 * Aj keď sa v tejto verzii nepoužíva, je tu pre prípadné budúce využitie.
 */
function showLocalNotification(message, type = 'success') {
    let notificationElement = document.getElementById('local-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'local-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
}


// Main React component for the logged-in-rosters.html page
function RostersApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  // Loading stav pre používateľský profil
  const [loading, setLoading] = React.useState(true); 

  // Používateľské ID pre Firebase App ID
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        console.log("RostersApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
      if (window.hideGlobalLoader) {
        window.hideGlobalLoader();
      }
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (window.hideGlobalLoader) {
                window.hideGlobalLoader();
            }
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, []); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`RostersApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          console.log("RostersApp: Používateľský dokument existuje, dáta:", docSnapshot.data());

          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            setUserProfileData(userData);
            setLoading(false);

            // Ak nie je admin, presmeruj na inú stránku
            if (userData.role !== 'admin') {
                console.log("RostersApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
            }

          } else {
            console.warn("RostersApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            // showLocalNotification sa nepoužíva v tejto verzii, ale je tu pre referenciu
            // if (typeof showLocalNotification === 'function') { 
            //     showLocalNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error');
            // }
            setLoading(false);
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("RostersApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          // showLocalNotification sa nepoužíva v tejto verzii
          // if (typeof showLocalNotification === 'function') { 
          //   showLocalNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error');
          // }
          setLoading(false);
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("RostersApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        // showLocalNotification sa nepoužíva v tejto verzii
        // if (typeof showLocalNotification === 'function') { 
        //     showLocalNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error');
        // }
        setLoading(false);
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } else if (isAuthReady && user === null) {
        setLoading(false);
        setUserProfileData(null);
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("RostersApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);


  if (!isAuthReady || !userProfileData) {
    // Ak autentifikácia alebo profil ešte nie sú pripravené, zobrazíme prázdnu stránku
    // alebo loader, ktorý je už v logged-in-rosters.html
    return null;
  }

  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(
      'div',
      { className: 'w-full max-w-3xl p-4' },
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Súpiska tímov'
        ),
        // Tu bude vykreslený obsah pre súpisku tímov (zatiaľ prázdny)
        React.createElement('p', { className: 'text-center text-gray-600' }, 'Zatiaľ neboli vytvorené žiadne tímy.')
      )
    )
    // Tlačidlo "+" na pridanie kategórie je odstránené
  );
}

// Explicitne sprístupniť komponent globálne
window.RostersApp = RostersApp;
