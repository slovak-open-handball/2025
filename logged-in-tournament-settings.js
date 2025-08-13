import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Všetky pomocné funkcie sú teraz priamo v tomto súbore
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateForDisplay = (dateOrTimestamp) => {
  let date;
  if (!dateOrTimestamp) return 'nezadané';
  
  if (dateOrTimestamp instanceof Timestamp) {
    date = dateOrTimestamp.toDate();
  } else if (dateOrTimestamp instanceof Date) {
    date = dateOrTimestamp;
  } else {
    return 'nezadané';
  }

  if (isNaN(date.getTime())) {
      return 'nezadané';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}. ${month}. ${year} ${hours}:${minutes} hod.`;
};

const showNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification'); 
    
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';

    if (type === 'success') {
        typeClasses = 'bg-green-500 text-white';
    } else if (type === 'error') {
        typeClasses = 'bg-red-500 text-white';
    } else {
        typeClasses = 'bg-blue-500 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 10);

    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 5000);
};

const sendAdminNotification = async (db, auth, notificationData) => {
    if (!db || !auth.currentUser || !auth.currentUser.email) { 
      console.warn("sendAdminNotification: Nemám prístup k databáze alebo k používateľovi.");
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      let changesMessage = '';
      const userEmail = auth.currentUser.email;

      if (notificationData.type === 'createSize') {
        changesMessage = `Vytvorenie novej veľkosti trička: '''${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'editSize') {
        changesMessage = `Zmena veľkosti trička z: '${notificationData.data.originalSize}' na '${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'deleteSize') {
        changesMessage = `Zmazanie veľkosti trička: '''${notificationData.data.deletedSize}'`;
      } else if (notificationData.type === 'updateSettings') {
        changesMessage = `${notificationData.data.changesMade}`; 
      } else if (notificationData.type === 'createAccommodation') { 
        changesMessage = `Vytvorenie typu ubytovania: '''${notificationData.data.type} s kapacitou ${notificationData.data.capacity}'`;
      } else if (notificationData.type === 'editAccommodation') { 
        changesMessage = `Zmena ubytovania z: '${notificationData.data.originalType} (kapacita: ${notificationData.data.originalCapacity})' na '${notificationData.data.newType} (kapacita: ${notificationData.data.newCapacity})'`;
      } else if (notificationData.type === 'deleteAccommodation') { 
        changesMessage = `Zmazanie typu ubytovania: '''${notificationData.data.deletedType} (kapacita: ${notificationData.data.deletedCapacity})'`;
      } else if (notificationData.type === 'createPackage') {
        changesMessage = `Vytvorenie nového balíčka: '''${notificationData.data.name} s cenou ${notificationData.data.price}€'`;
      } else if (notificationData.type === 'editPackage') {
        const originalPackage = notificationData.data.originalPackage;
        const newPackage = notificationData.data.newPackage;
        const changes = [];

        // Pridávam obranné kontroly pre originalPackage a newPackage
        if (!originalPackage || !newPackage) {
            console.error("sendAdminNotification: Chýbajú pôvodné alebo nové dáta balíčka pre notifikáciu 'editPackage'.");
            changesMessage = `Úprava balíčka '${notificationData.data.originalName || 'Neznámy názov'}'. Podrobnosti o zmene nie sú k dispozícii.`;
            // Ak nemáme kompletné dáta, vrátime sa k jednoduchšej správe, alebo preskočíme ďalšie porovnania.
            await addDoc(notificationsCollectionRef, {
                userEmail: userEmail,
                changes: changesMessage,
                timestamp: Timestamp.fromDate(new Date()),
                recipientId: 'all_admins'
            });
            return; 
        }

        if (originalPackage.name !== newPackage.name) {
          changes.push(`Názov: '${originalPackage.name}' -> '${newPackage.name}'`);
        }
        if (originalPackage.price !== newPackage.price) {
          changes.push(`Cena: ${originalPackage.price}€ -> ${newPackage.price}€`);
        }

        const mealTypes = ['breakfast', 'lunch', 'dinner', 'refreshment'];
        const allDates = new Set([...Object.keys(originalPackage.meals || {}), ...Object.keys(newPackage.meals || {})]);
        const sortedDates = Array.from(allDates).sort();


        sortedDates.forEach(date => {
            mealTypes.forEach(mealType => {
                const oldStatus = (originalPackage.meals && originalPackage.meals[date] && originalPackage.meals[date][mealType] === 1);
                const newStatus = (newPackage.meals && newPackage.meals[date] && newPackage.meals[date][mealType] === 1);
                const displayDate = new Date(date).toLocaleDateString('sk-SK');
                const mealName = mealType === 'breakfast' ? 'Raňajky' : mealType === 'lunch' ? 'Obed' : mealType === 'dinner' ? 'Večera' : 'Občerstvenie';

                if (oldStatus !== newStatus) {
                    if (newStatus) {
                        changes.push(`Pre ${displayDate} bol pridaný ${mealName}.`);
                    } else {
                        changes.push(`Pre ${displayDate} bolo odobraté ${mealName}.`);
                    }
                }
            });
        });

        const oldParticipantCard = (originalPackage.meals && originalPackage.meals.participantCard === 1);
        const newParticipantCard = (newPackage.meals && newPackage.meals.participantCard === 1);

        if (oldParticipantCard !== newParticipantCard) {
            if (newParticipantCard) {
                changes.push('Účastnícka karta bola pridaná.');
            } else {
                changes.push('Účastnícka karta bola odobratá.');
            }
        }
        
        changesMessage = `Úprava balíčka '${originalPackage.name}':\n${changes.join('\n')}`;

      } else if (notificationData.type === 'deletePackage') {
        changesMessage = `Zmazanie balíčka: '''${notificationData.data.deletedName} (cena: ${notificationData.data.deletedPrice}€)'`;
      }

      await addDoc(notificationsCollectionRef, {
        userEmail: userEmail,
        changes: changesMessage,
        timestamp: Timestamp.fromDate(new Date()),
        recipientId: 'all_admins'
      });
    } catch (e) {
      showNotification(`Chyba pri ukladaní notifikácie pre administrátorov: ${e.message}`, 'error');
    }
};


// Import komponentov nastavení
import { GeneralRegistrationSettings } from './logged-in-tournament-settings-general-registration-settings.js';
import { TShirtSizeSettings } from './logged-in-tournament-settings-t-shirt-size-settings.js';
import { AccommodationSettings } from './logged-in-tournament-settings-accommodation-settings.js';
import { PackageSettings } from './logged-in-tournament-settings-package-settings.js';


function TournamentSettingsApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  const [tournamentStartDate, setTournamentStartDate] = React.useState('');
  const [tournamentEndDate, setTournamentEndDate] = React.useState('');


  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
      if (!currentUser) {
        window.location.href = 'login.html';
      }
    });

    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    if (window.isGlobalAuthReady) {
        setIsAuthReady(true);
        setUser(auth.currentUser);
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
        }
    }

    return () => {
      unsubscribeAuth();
      window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
    };
  }, [auth]); 

  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();

            if (userData.role !== 'admin') {
                window.location.href = 'logged-in-my-data.html';
                return; 
            }

            setUserProfileData(userData); 
          } else {
            showNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error'); 
            auth.signOut(); 
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          showNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error'); 
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        showNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error'); 
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } 
    else if (isAuthReady && user === null) {
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

    React.useEffect(() => {
        let unsubscribeSettings;
        const fetchTournamentDates = () => {
            if (!db || !userProfileData || userProfileData.role !== 'admin') {
                return;
            }
            try {
                const settingsDocRef = doc(db, 'settings', 'registration');
                unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
                    if (docSnapshot.exists()) {
                        const data = docSnapshot.data();
                        setTournamentStartDate(data.tournamentStart ? formatToDatetimeLocal(data.tournamentStart.toDate()) : '');
                        setTournamentEndDate(data.tournamentEnd ? formatToDatetimeLocal(data.tournamentEnd.toDate()) : '');
                    } else {
                        setTournamentStartDate('');
                        setTournamentEndDate('');
                    }
                }, error => {
                    showNotification(`Chyba pri načítaní dátumov turnaja: ${error.message}`, 'error');
                });
            } catch (e) {
                showNotification(`Chyba pri nastavovaní poslucháča pre dátumy turnaja: ${e.message}`, 'error');
            }
        };

        fetchTournamentDates();

        return () => {
            if (unsubscribeSettings) {
                unsubscribeSettings();
            }
        };
    }, [db, userProfileData]);


  if (!userProfileData || userProfileData.role !== 'admin') {
    return null; 
  }

  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, 
    React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
      'Nastavenia turnaja'
    ),
    
    React.createElement(GeneralRegistrationSettings, {
        db: db,
        userProfileData: userProfileData,
        tournamentStartDate: tournamentStartDate,
        setTournamentStartDate: setTournamentStartDate,
        tournamentEndDate: tournamentEndDate,
        setTournamentEndDate: setTournamentEndDate,
        showNotification: showNotification,
        sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
        formatDateForDisplay: formatDateForDisplay, // Pridávame format funkcie ako props
        formatToDatetimeLocal: formatToDatetimeLocal,
    }),

    React.createElement(TShirtSizeSettings, {
        db: db,
        userProfileData: userProfileData,
        showNotification: showNotification,
        sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
    }),

    React.createElement(AccommodationSettings, {
        db: db,
        userProfileData: userProfileData,
        showNotification: showNotification,
        sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
    }),

    React.createElement(PackageSettings, {
        db: db,
        userProfileData: userProfileData,
        tournamentStartDate: tournamentStartDate,
        tournamentEndDate: tournamentEndDate,
        showNotification: showNotification,
        sendAdminNotification: (notificationData) => sendAdminNotification(db, auth, notificationData),
    })
  );
}

window.TournamentSettingsApp = TournamentSettingsApp;
