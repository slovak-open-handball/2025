// logged-in-tournament-settings.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, window.showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot, setDoc, Timestamp, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Helper funkcia pre formátovanie objektu Date do lokálneho reťazca 'YYYY-MM-DDTHH:mm'
const formatToDatetimeLocal = (date) => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper funkcia pre formátovanie objektu Date/Timestamp na 'DD. MM. YYYY HH:mm hod.' pre zobrazenie v notifikáciách
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

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}. ${month}. ${year} ${hours}:${minutes} hod.`;
};

/**
 * Lokálna funkcia pre zobrazenie notifikácií v tomto module.
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách.
 * Používa štýly z logged-in-my-data.js (farba pozadia) a nemá ikonu.
 */
const showNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification'); 
    
    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        document.body.appendChild(notificationElement);
    }

    // Základné triedy pre pozíciu a prechod, rovnaké ako v logged-in-my-data.js
    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';

    // Nastavíme farbu pozadia na základe typu notifikácie
    if (type === 'success') {
        typeClasses = 'bg-green-500 text-white'; // Zelená pre úspech (ako v logged-in-my-data.js)
    } else if (type === 'error') {
        typeClasses = 'bg-red-500 text-white'; // Červená pre chybu (ako v logged-in-my-data.js)
    } else {
        typeClasses = 'bg-blue-500 text-white'; // Predvolená modrá pre info
    }

    // Nastavíme triedy elementu
    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    // Nastavíme textContent namiesto innerHTML, aby sa zabránilo vkladaniu SVG ikony
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 10);

    // Skrytie notifikácie po 5 sekundách (ako v logged-in-my-data.js)
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'scale-100', 'pointer-events-auto');
    }, 5000);
};


// Main React komponent pre stránku nastavení turnaja
function TournamentSettingsApp() {
  // Získame referencie na Firebase služby pomocou getAuth() a getFirestore()
  const auth = getAuth(); 
  const db = getFirestore();     

  // Lokálny stav pre aktuálneho používateľa a jeho profilové dáta
  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 

  // Stavy pre nastavenia dátumu a času
  const [registrationStartDate, setRegistrationStartDate] = React.useState('');
  const [registrationEndDate, setRegistrationEndDate] = React.useState('');
  const [dataEditDeadline, setDataEditDeadline] = React.useState(''); 
  const [rosterEditDeadline, setRosterEditDeadline] = React.useState(''); 
  // Stavy pre počet hráčov a členov realizačného tímu
  const [numberOfPlayers, setNumberOfPlayers] = React.useState(0);
  const [numberOfImplementationTeam, setNumberOfImplementationTeam] = React.useState(0);

  // Stavy pre správu veľkostí tričiek
  const [tshirtSizes, setTshirtSizes] = React.useState([]);
  const [showSizeModal, setShowSizeModal] = React.useState(false);
  const [currentSizeEdit, setCurrentSizeEdit] = React.useState(null); // null pre pridanie, string pre úpravu
  const [newSizeValue, setNewSizeValue] = React.useState('');
  const [modalMode, setModalMode] = React.useState('add'); // 'add' alebo 'edit'

  // Stavy pre modálne okno na potvrdenie zmazania
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = React.useState(false);
  const [sizeToDelete, setSizeToDelete] = React.useState(null);

  // NOVÉ STAVY pre správu ubytovania
  const [accommodations, setAccommodations] = React.useState([]);
  const [showAccommodationModal, setShowAccommodationModal] = React.useState(false);
  const [currentAccommodationEdit, setCurrentAccommodationEdit] = React.useState(null); // null pre pridanie, objekt pre úpravu
  const [newAccommodationType, setNewAccommodationType] = React.useState('');
  const [newAccommodationCapacity, setNewAccommodationCapacity] = React.useState(0);
  const [accommodationModalMode, setAccommodationModalMode] = React.useState('add'); // 'add' alebo 'edit'
  const [showConfirmDeleteAccommodationModal, setShowConfirmDeleteAccommodationModal] = React.useState(false);
  const [accommodationToDelete, setAccommodationToDelete] = React.useState(null);


  // Stav pre indikáciu, či je registrácia aktívna (na základe dátumov)
  const isRegistrationOpen = React.useMemo(() => {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;

    const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
    const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

    // Registrácia je otvorená, ak aktuálny čas je medzi dátumom začiatku a konca (vrátane, ak dátumy existujú)
    return (isRegStartValid ? now >= regStart : true) && (isRegEndValid ? now <= regEnd : true);
  }, [registrationStartDate, registrationEndDate]);

  // Stav pre indikáciu, či majú byť polia zablokované (od začiatku registrácie ďalej)
  const isFrozenForEditing = React.useMemo(() => {
    const now = new Date();
    const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
    // Je zablokované, ak regStart existuje a aktuálny čas je >= regStart
    return regStart instanceof Date && !isNaN(regStart) && now >= regStart;
  }, [registrationStartDate]);


  // Effect pre inicializáciu a sledovanie globálneho stavu autentifikácie a profilu
  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); // Auth je pripravené
      if (!currentUser) {
        console.log("TournamentSettingsApp: Používateľ nie je prihlásený, presmerovávam na login.html.");
        window.location.href = 'login.html';
      }
    });

    // Listener pre globalDataUpdated z authentication.js
    const handleGlobalDataUpdated = (event) => {
      setUserProfileData(event.detail);
    };
    window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);

    // Počiatočné nastavenie, ak už sú dáta dostupné
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
  }, [auth]); // Závisí od auth inštancie

  // Effect pre načítanie používateľských dát z Firestore a kontrolu roly
  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`TournamentSettingsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => {
          console.log("TournamentSettingsApp: onSnapshot pre používateľský dokument spustený.");
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("TournamentSettingsApp: Používateľský dokument existuje, dáta:", userData);

            // Ak používateľ nie je admin, presmerujeme ho
            if (userData.role !== 'admin') {
                console.log("TournamentSettingsApp: Používateľ nie je admin, presmerovávam na logged-in-my-data.html.");
                window.location.href = 'logged-in-my-data.html';
                return; 
            }

            setUserProfileData(userData); // Update userProfileData state
          } else {
            console.warn("TournamentSettingsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            showNotification("Chyba: Používateľský profil sa nenašiel. Skúste sa prosím znova prihlásiť.", 'error'); // Používame lokálnu showNotification
            auth.signOut(); // Odhlásiť používateľa
            setUser(null);
            setUserProfileData(null);
          }
        }, error => {
          console.error("TournamentSettingsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          showNotification(`Chyba pri načítaní používateľských dát: ${error.message}`, 'error'); // Používame lokálnu showNotification
          auth.signOut();
          setUser(null);
          setUserProfileData(null);
        });
      } catch (e) {
        console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        showNotification(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`, 'error'); // Používame lokálnu showNotification
        auth.signOut();
        setUser(null);
        setUserProfileData(null);
      }
    } 
    // Ak je autentifikácia pripravená, ale používateľ je null (nie je prihlásený),
    // loader zostane viditeľný, kým neprebehne presmerovanie v onAuthStateChanged.
    else if (isAuthReady && user === null) {
        console.log("TournamentSettingsApp: Auth je pripravené, ale používateľ nie je prihlásený. Loader zostáva zobrazený.");
    }

    return () => {
      if (unsubscribeUserDoc) {
        console.log("TournamentSettingsApp: Ruším odber onSnapshot pre používateľský dokument.");
        unsubscribeUserDoc();
      }
    };
  }, [user, db, isAuthReady, auth]);

  // Effect pre načítanie nastavení (spustí sa po inicializácii DB a Auth a ak je používateľ admin)
  React.useEffect(() => {
    let unsubscribeSettings;
    const fetchSettings = async () => {
      // Načítavanie nastavení spustíme len vtedy, ak je používateľ admin.
      // Ak userProfileData ešte nie je k dispozícii alebo používateľ nie je admin,
      // loader zostane viditeľný vďaka hlavnému loading stavu a podmienke vykresľovania.
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        console.log("TournamentSettingsApp: Čakám na DB alebo admin rolu pre načítanie nastavení.");
        return; 
      }
      try {
          console.log("TournamentSettingsApp: Pokúšam sa načítať nastavenia registrácie.");
          const settingsDocRef = doc(db, 'settings', 'registration');
          unsubscribeSettings = onSnapshot(settingsDocRef, docSnapshot => {
            console.log("TournamentSettingsApp: onSnapshot pre nastavenia registrácie spustený.");
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                console.log("TournamentSettingsApp: Nastavenia registrácie existujú, dáta:", data);
                setRegistrationStartDate(data.registrationStartDate ? formatToDatetimeLocal(data.registrationStartDate.toDate()) : '');
                setRegistrationEndDate(data.registrationEndDate ? formatToDatetimeLocal(data.registrationEndDate.toDate()) : '');
                setDataEditDeadline(data.dataEditDeadline ? formatToDatetimeLocal(data.dataEditDeadline.toDate()) : ''); 
                setRosterEditDeadline(data.rosterEditDeadline ? formatToDatetimeLocal(data.rosterEditDeadline.toDate()) : ''); // Načítanie nového dátumu
                // NOVINKA: Načítanie počtu hráčov a členov realizačného tímu
                setNumberOfPlayers(data.numberOfPlayers || 0);
                setNumberOfImplementationTeam(data.numberOfImplementationTeam || 0);

            } else {
                console.log("TournamentSettingsApp: Nastavenia registrácie sa nenašli v Firestore. Používajú sa predvolené prázdne hodnoty.");
                setRegistrationStartDate('');
                setRegistrationEndDate('');
                setDataEditDeadline(''); 
                setRosterEditDeadline(''); // Predvolená prázdna hodnota pre nový dátum
                // NOVINKA: Predvolené hodnoty pre počet hráčov a členov realizačného tímu
                setNumberOfPlayers(0);
                setNumberOfImplementationTeam(0);
            }
          }, error => {
            console.error("TournamentSettingsApp: Chyba pri načítaní nastavení registrácie (onSnapshot error):", error);
            showNotification(`Chyba pri načítaní nastavení: ${error.message}`, 'error'); // Používame lokálnu showNotification
          });

          return () => {
            if (unsubscribeSettings) {
                console.log("TournamentSettingsApp: Ruším odber onSnapshot pre nastavenia registrácie.");
                unsubscribeSettings();
            }
          };
      } catch (e) {
          console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre nastavenia registrácie (try-catch):", e);
          showNotification(`Chyba pri nastavovaní poslucháča pre nastavenia: ${e.message}`, 'error'); // Používame lokálnu showNotification
      }
    };

    fetchSettings();
  }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu)

  // Effect pre načítanie veľkostí tričiek
  React.useEffect(() => {
    let unsubscribeTshirtSizes;
    const fetchTshirtSizes = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        console.log("TournamentSettingsApp: Čakám na DB alebo admin rolu pre načítanie veľkostí tričiek.");
        return;
      }

      try {
        console.log("TournamentSettingsApp: Pokúšam sa načítať nastavenia veľkostí tričiek.");
        const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');
        unsubscribeTshirtSizes = onSnapshot(tshirtSizesDocRef, docSnapshot => {
          console.log("TournamentSettingsApp: onSnapshot pre veľkosti tričiek spustený.");
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log("TournamentSettingsApp: Nastavenia veľkostí tričiek existujú, dáta:", data);
            // Predpokladáme, že veľkosti sú uložené v poli 'sizes'
            setTshirtSizes(data.sizes || []);
          } else {
            console.log("TournamentSettingsApp: Nastavenia veľkostí tričiek sa nenašli. Vytváram predvolené hodnoty.");
            // Vytvorenie dokumentu s predvolenými hodnotami, ak neexistuje
            setDoc(tshirtSizesDocRef, {
              sizes: [
                '134 - 140',
                '146 - 152',
                '158 - 164',
                'XS',
                'S',
                'M',
                'L',
                'XL',
                'XXL',
                'XXXL'
              ]
            }).then(() => {
              console.log("Predvolené veľkosti tričiek boli úspešne vytvorené.");
            }).catch(e => {
              console.error("Chyba pri vytváraní predvolených veľkostí tričiek:", e);
              showNotification(`Chyba pri vytváraní predvolených veľkostí tričiek: ${e.message}`, 'error');
            });
            setTshirtSizes([]); // Zatiaľ prázdne, kým sa dokument nevytvorí a neaktualizuje onSnapshot
          }
        }, error => {
          console.error("TournamentSettingsApp: Chyba pri načítaní nastavení veľkostí tričiek (onSnapshot error):", error);
          showNotification(`Chyba pri načítaní veľkostí tričiek: ${error.message}`, 'error');
        });

        return () => {
          if (unsubscribeTshirtSizes) {
            console.log("TournamentSettingsApp: Ruším odber onSnapshot pre veľkosti tričiek.");
            unsubscribeTshirtSizes();
          }
        };
      } catch (e) {
        console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre veľkosti tričiek (try-catch):", e);
        showNotification(`Chyba pri nastavovaní poslucháča pre veľkosti tričiek: ${e.message}`, 'error');
      }
    };

    fetchTshirtSizes();
  }, [db, userProfileData]);

  // NOVÝ Effect pre načítanie ubytovacích kapacít
  React.useEffect(() => {
    let unsubscribeAccommodation;
    const fetchAccommodation = async () => {
      if (!db || !userProfileData || userProfileData.role !== 'admin') {
        console.log("TournamentSettingsApp: Čakám na DB alebo admin rolu pre načítanie ubytovania.");
        return;
      }

      try {
        console.log("TournamentSettingsApp: Pokúšam sa načítať nastavenia ubytovania.");
        const accommodationDocRef = doc(db, 'settings', 'accommodation');
        unsubscribeAccommodation = onSnapshot(accommodationDocRef, docSnapshot => {
          console.log("TournamentSettingsApp: onSnapshot pre ubytovanie spustený.");
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log("TournamentSettingsApp: Nastavenia ubytovania existujú, dáta:", data);
            setAccommodations(data.types || []); // Predpokladáme, že typy sú uložené v poli 'types'
          } else {
            console.log("TournamentSettingsApp: Nastavenia ubytovania sa nenašli. Vytváram predvolené hodnoty.");
            setDoc(accommodationDocRef, {
              types: []
            }).then(() => {
              console.log("Predvolené typy ubytovania boli úspešne vytvorené.");
            }).catch(e => {
              console.error("Chyba pri vytváraní predvolených typov ubytovania:", e);
              showNotification(`Chyba pri vytváraní predvolených typov ubytovania: ${e.message}`, 'error');
            });
            setAccommodations([]); // Zatiaľ prázdne, kým sa dokument nevytvorí a neaktualizuje onSnapshot
          }
        }, error => {
          console.error("TournamentSettingsApp: Chyba pri načítaní nastavení ubytovania (onSnapshot error):", error);
          showNotification(`Chyba pri načítaní ubytovania: ${error.message}`, 'error');
        });

        return () => {
          if (unsubscribeAccommodation) {
            console.log("TournamentSettingsApp: Ruším odber onSnapshot pre ubytovanie.");
            unsubscribeAccommodation();
          }
        };
      } catch (e) {
        console.error("TournamentSettingsApp: Chyba pri nastavovaní onSnapshot pre ubytovanie (try-catch):", e);
        showNotification(`Chyba pri nastavovaní poslucháča pre ubytovanie: ${e.message}`, 'error');
      }
    };

    fetchAccommodation();
  }, [db, userProfileData]);

  // Funkcia na odoslanie notifikácie administrátorom
  const sendAdminNotification = async (notificationData) => {
    if (!db || !user || !user.email) { 
      console.error("Chyba: Databáza alebo používateľ nie je k dispozícii pre odoslanie notifikácie.");
      return;
    }
    try {
      const notificationsCollectionRef = collection(db, 'notifications');
      let changesMessage = '';
      const userEmail = user.email;

      if (notificationData.type === 'createSize') {
        changesMessage = `Vytvorenie novej veľkosti trička: '''${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'editSize') {
        changesMessage = `Zmena veľkosti trička z: '${notificationData.data.originalSize}' na '${notificationData.data.newSizeValue}'`;
      } else if (notificationData.type === 'deleteSize') {
        changesMessage = `Zmazanie veľkosti trička: '''${notificationData.data.deletedSize}'`;
      } else if (notificationData.type === 'updateSettings') {
        changesMessage = `${notificationData.data.changesMade}`; 
      } else if (notificationData.type === 'createAccommodation') { // NOVÁ notifikácia pre ubytovanie
        changesMessage = `Vytvorenie typu ubytovania: '${notificationData.data.type}' s kapacitou '${notificationData.data.capacity}'`;
      } else if (notificationData.type === 'editAccommodation') { // NOVÁ notifikácia pre ubytovanie
        changesMessage = `Zmena ubytovania z: '${notificationData.data.originalType}' (kapacita: ${notificationData.data.originalCapacity}) na '${notificationData.data.newType}' (kapacita: ${notificationData.data.newCapacity})`;
      } else if (notificationData.type === 'deleteAccommodation') { // NOVÁ notifikácia pre ubytovanie
        changesMessage = `Zmazanie typu ubytovania: '${notificationData.data.deletedType}' (kapacita: ${notificationData.data.deletedCapacity})`;
      }

      await addDoc(notificationsCollectionRef, {
        userEmail: userEmail,
        changes: changesMessage,
        timestamp: Timestamp.fromDate(new Date()),
        recipientId: 'all_admins'
      });
      console.log("Notifikácia pre administrátorov úspešne uložená do Firestore.");
    } catch (e) {
      console.error("TournamentSettingsApp: Chyba pri ukladaní notifikácie pre administrátorov:", e);
      showNotification(`Chyba pri ukladaní notifikácie pre administrátorov: ${e.message}`, 'error');
    }
  };


  const handleUpdateRegistrationSettings = async (e) => {
    e.preventDefault();
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmenu nastavení registrácie.", 'error'); 
      return;
    }
    
    try {
      const regStart = registrationStartDate ? new Date(registrationStartDate) : null;
      const regEnd = registrationEndDate ? new Date(registrationEndDate) : null;
      const dataEditDead = dataEditDeadline ? new Date(dataEditDeadline) : null; 
      const rosterEditDead = rosterEditDeadline ? new Date(rosterEditDeadline) : null; 

      if (regStart && regEnd && regStart >= regEnd) {
        showNotification("Dátum začiatku registrácie musí byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (dataEditDead && regEnd && dataEditDead < regEnd) {
        showNotification("Dátum uzávierky úprav dát nemôže byť pred dátumom konca registrácie.", 'error'); 
        return;
      }
      if (rosterEditDead && dataEditDead && rosterEditDead < dataEditDead) {
        showNotification("Dátum uzávierky úprav súpisiek nemôže byť pred dátumom uzávierky úprav používateľských dát.", 'error');
        return;
      }

      if (numberOfPlayers < 0) {
        showNotification("Počet hráčov nemôže byť záporný.", 'error');
        return;
      }
      if (numberOfImplementationTeam < 0) {
        showNotification("Počet členov realizačného tímu nemôže byť záporný.", 'error');
        return;
      }

      const settingsDocRef = doc(db, 'settings', 'registration');
      const oldSettingsDoc = await getDoc(settingsDocRef);
      const oldData = oldSettingsDoc.exists() ? oldSettingsDoc.data() : {};
      let changes = [];

      // Porovnanie a zber zmien
      if ((oldData.registrationStartDate ? oldData.registrationStartDate.toMillis() : null) !== (regStart ? Timestamp.fromDate(regStart).toMillis() : null)) {
          changes.push(`Dátum začiatku registrácie z '${formatDateForDisplay(oldData.registrationStartDate)}' na '${formatDateForDisplay(regStart)}'`);
      }
      if ((oldData.registrationEndDate ? oldData.registrationEndDate.toMillis() : null) !== (regEnd ? Timestamp.fromDate(regEnd).toMillis() : null)) {
          changes.push(`Dátum konca registrácie z '${formatDateForDisplay(oldData.registrationEndDate)}' na '${formatDateForDisplay(regEnd)}'`);
      }
      if ((oldData.dataEditDeadline ? oldData.dataEditDeadline.toMillis() : null) !== (dataEditDead ? Timestamp.fromDate(dataEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav dát z '${formatDateForDisplay(oldData.dataEditDeadline)}' na '${formatDateForDisplay(dataEditDead)}'`);
      }
      if ((oldData.rosterEditDeadline ? oldData.rosterEditDeadline.toMillis() : null) !== (rosterEditDead ? Timestamp.fromDate(rosterEditDead).toMillis() : null)) {
          changes.push(`Uzávierka úprav súpisiek z '${formatDateForDisplay(oldData.rosterEditDeadline)}' na '${formatDateForDisplay(rosterEditDead)}'`);
      }

      if (oldData.numberOfPlayers !== numberOfPlayers) {
          changes.push(`Maximálny počet hráčov v tíme z '${oldData.numberOfPlayers || 0}' na '${numberOfPlayers}'`);
      }
      if (oldData.numberOfImplementationTeam !== numberOfImplementationTeam) {
          changes.push(`Maximálny počet členov realizačného tímu z '${oldData.numberOfImplementationTeam || 0}' na '${numberOfImplementationTeam}'`);
      }

      await setDoc(settingsDocRef, {
        registrationStartDate: regStart ? Timestamp.fromDate(regStart) : null,
        registrationEndDate: regEnd ? Timestamp.fromDate(regEnd) : null,
        dataEditDeadline: dataEditDead ? Timestamp.fromDate(dataEditDead) : null, 
        rosterEditDeadline: rosterEditDead ? Timestamp.fromDate(rosterEditDead) : null, 
        numberOfPlayers: numberOfPlayers,
        numberOfImplementationTeam: numberOfImplementationTeam,
      });
      
      showNotification("Nastavenia registrácie úspešne aktualizované!", 'success'); 

      if (changes.length > 0) {
          await sendAdminNotification({
              type: 'updateSettings',
              data: {
                  changesMade: changes.join('; ')
              }
          });
      }

    } catch (e) {
      console.error("TournamentSettingsApp: Chyba pri aktualizácii nastavení registrácie:", e);
      showNotification(`Chyba pri aktualizácii nastavenia: ${e.message}`, 'error'); 
    }
  };

  // Funkcie pre správu veľkostí tričiek
  const handleOpenAddSizeModal = () => {
    setModalMode('add');
    setNewSizeValue('');
    setCurrentSizeEdit(null);
    setShowSizeModal(true);
  };

  const handleOpenEditSizeModal = (size) => {
    setModalMode('edit');
    setNewSizeValue(size);
    setCurrentSizeEdit(size);
    setShowSizeModal(true);
  };

  const handleCloseSizeModal = () => {
    setShowSizeModal(false);
    setNewSizeValue('');
    setCurrentSizeEdit(null);
    setModalMode('add');
  };

  const handleSaveSize = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmenu nastavení veľkostí tričiek.", 'error');
      return;
    }

    const trimmedNewSize = newSizeValue.trim();
    if (!trimmedNewSize) {
      showNotification("Názov veľkosti nemôže byť prázdny.", 'error');
      return;
    }

    const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');

    try {
      if (modalMode === 'add') {
        // Kontrola duplicity pri pridávaní
        if (tshirtSizes.includes(trimmedNewSize)) {
          showNotification(`Veľkosť "${trimmedNewSize}" už existuje.`, 'error');
          return;
        }
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayUnion(trimmedNewSize)
        });
        showNotification(`Veľkosť "${trimmedNewSize}" úspešne pridaná!`, 'success');
        await sendAdminNotification({ type: 'createSize', data: { newSizeValue: trimmedNewSize } });
      } else if (modalMode === 'edit') {
        // Kontrola duplicity pri úprave (nesmie sa zhodovať s inou veľkosťou, okrem seba samej)
        if (trimmedNewSize !== currentSizeEdit && tshirtSizes.includes(trimmedNewSize)) {
            showNotification(`Veľkosť "${trimmedNewSize}" už existuje.`, 'error');
            return;
        }
        // Najprv odstránime starú hodnotu a potom pridáme novú
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayRemove(currentSizeEdit)
        });
        await updateDoc(tshirtSizesDocRef, {
          sizes: arrayUnion(trimmedNewSize)
        });
        showNotification(`Veľkosť "${currentSizeEdit}" úspešne zmenená na "${trimmedNewSize}"!`, 'success');
        await sendAdminNotification({ type: 'editSize', data: { originalSize: currentSizeEdit, newSizeValue: trimmedNewSize } });
      }
      handleCloseSizeModal();
    } catch (e) {
      console.error("Chyba pri ukladaní veľkosti trička:", e);
      showNotification(`Chyba pri ukladaní veľkosti trička: ${e.message}`, 'error');
    }
  };

  const handleOpenConfirmDeleteModal = (size) => {
    setSizeToDelete(size);
    setShowConfirmDeleteModal(true);
  };

  const handleCloseConfirmDeleteModal = () => {
    setShowConfirmDeleteModal(false);
    setSizeToDelete(null);
  };

  const handleDeleteSize = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmazanie veľkosti trička.", 'error');
      return;
    }
    if (!sizeToDelete) return;

    try {
      const tshirtSizesDocRef = doc(db, 'settings', 'sizeTshirts');
      await updateDoc(tshirtSizesDocRef, {
        sizes: arrayRemove(sizeToDelete)
      });
      showNotification(`Veľkosť "${sizeToDelete}" úspešne zmazaná!`, 'success');
      await sendAdminNotification({ type: 'deleteSize', data: { deletedSize: sizeToDelete } });
      handleCloseConfirmDeleteModal();
    } catch (e) {
      console.error("Chyba pri mazaní veľkosti trička:", e);
      showNotification(`Chyba pri mazaní veľkosti trička: ${e.message}`, 'error');
    }
  };

  // NOVÉ FUNKCIE pre správu ubytovania
  const handleOpenAddAccommodationModal = () => {
    setAccommodationModalMode('add');
    setNewAccommodationType('');
    setNewAccommodationCapacity(0);
    setCurrentAccommodationEdit(null);
    setShowAccommodationModal(true);
  };

  const handleOpenEditAccommodationModal = (accommodation) => {
    setAccommodationModalMode('edit');
    setNewAccommodationType(accommodation.type);
    setNewAccommodationCapacity(accommodation.capacity);
    setCurrentAccommodationEdit(accommodation);
    setShowAccommodationModal(true);
  };

  const handleCloseAccommodationModal = () => {
    setShowAccommodationModal(false);
    setNewAccommodationType('');
    setNewAccommodationCapacity(0);
    setCurrentAccommodationEdit(null);
    setAccommodationModalMode('add');
  };

  const handleSaveAccommodation = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmenu nastavení ubytovania.", 'error');
      return;
    }

    const trimmedType = newAccommodationType.trim();
    if (!trimmedType) {
      showNotification("Názov typu ubytovania nemôže byť prázdny.", 'error');
      return;
    }
    if (newAccommodationCapacity < 0) {
      showNotification("Kapacita ubytovania nemôže byť záporná.", 'error');
      return;
    }

    const accommodationDocRef = doc(db, 'settings', 'accommodation');

    try {
      if (accommodationModalMode === 'add') {
        // Kontrola duplicity pri pridávaní
        if (accommodations.some(acc => acc.type === trimmedType)) {
          showNotification(`Typ ubytovania "${trimmedType}" už existuje.`, 'error');
          return;
        }
        await updateDoc(accommodationDocRef, {
          types: arrayUnion({ type: trimmedType, capacity: newAccommodationCapacity })
        });
        showNotification(`Typ ubytovania "${trimmedType}" úspešne pridaný!`, 'success');
        await sendAdminNotification({ type: 'createAccommodation', data: { type: trimmedType, capacity: newAccommodationCapacity } });
      } else if (accommodationModalMode === 'edit') {
        // Kontrola duplicity pri úprave (nesmie sa zhodovať s iným typom, okrem seba samej)
        if (trimmedType !== currentAccommodationEdit.type && accommodations.some(acc => acc.type === trimmedType)) {
            showNotification(`Typ ubytovania "${trimmedType}" už existuje.`, 'error');
            return;
        }
        // Najprv odstránime starú hodnotu a potom pridáme novú
        await updateDoc(accommodationDocRef, {
          types: arrayRemove(currentAccommodationEdit)
        });
        await updateDoc(accommodationDocRef, {
          types: arrayUnion({ type: trimmedType, capacity: newAccommodationCapacity })
        });
        showNotification(`Typ ubytovania "${currentAccommodationEdit.type}" úspešne zmenený na "${trimmedType}"!`, 'success');
        await sendAdminNotification({ type: 'editAccommodation', data: { originalType: currentAccommodationEdit.type, originalCapacity: currentAccommodationEdit.capacity, newType: trimmedType, newCapacity: newAccommodationCapacity } });
      }
      handleCloseAccommodationModal();
    } catch (e) {
      console.error("Chyba pri ukladaní ubytovania:", e);
      showNotification(`Chyba pri ukladaní ubytovania: ${e.message}`, 'error');
    }
  };

  const handleOpenConfirmDeleteAccommodationModal = (accommodation) => {
    setAccommodationToDelete(accommodation);
    setShowConfirmDeleteAccommodationModal(true);
  };

  const handleCloseConfirmDeleteAccommodationModal = () => {
    setShowConfirmDeleteAccommodationModal(false);
    setAccommodationToDelete(null);
  };

  const handleDeleteAccommodation = async () => {
    if (!db || !userProfileData || userProfileData.role !== 'admin' || !user) {
      showNotification("Nemáte oprávnenie na zmazanie ubytovania.", 'error');
      return;
    }
    if (!accommodationToDelete) return;

    try {
      const accommodationDocRef = doc(db, 'settings', 'accommodation');
      await updateDoc(accommodationDocRef, {
        types: arrayRemove(accommodationToDelete)
      });
      showNotification(`Typ ubytovania "${accommodationToDelete.type}" úspešne zmazaný!`, 'success');
      await sendAdminNotification({ type: 'deleteAccommodation', data: { deletedType: accommodationToDelete.type, deletedCapacity: accommodationToDelete.capacity } });
      handleCloseConfirmDeleteAccommodationModal();
    } catch (e) {
      console.error("Chyba pri mazaní ubytovania:", e);
      showNotification(`Chyba pri mazaní ubytovania: ${e.message}`, 'error');
    }
  };


  // Ak používateľ nie je admin, vrátime null, aby sa nič nevykreslilo
  if (!userProfileData || userProfileData.role !== 'admin') {
    return null; 
  }

  // Ak sa dostaneme sem, user je prihlásený, userProfileData sú načítané a rola je admin.
  return React.createElement(
    'div',
    { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto space-y-8' }, // Pridaný space-y-8 pre medzery medzi sekciami
    React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
      'Nastavenia turnaja'
    ),
    React.createElement(
      'form',
      { onSubmit: handleUpdateRegistrationSettings, className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm' }, // Sekcia pre registračné nastavenia
      React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Všeobecné nastavenia registrácie'),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-start-date' }, 'Dátum a čas začiatku registrácie'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'reg-start-date',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: registrationStartDate,
          onChange: (e) => setRegistrationStartDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'reg-end-date' }, 'Dátum a čas konca registrácie'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'reg-end-date',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: registrationEndDate,
          onChange: (e) => setRegistrationEndDate(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'data-edit-deadline' }, 'Dátum a čas uzávierky úprav používateľských dát'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'data-edit-deadline',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: dataEditDeadline,
          onChange: (e) => setDataEditDeadline(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'roster-edit-deadline' }, 'Dátum a čas uzávierky úprav súpisiek klubov/tímov'),
        React.createElement('input', {
          type: 'datetime-local',
          id: 'roster-edit-deadline',
          className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500',
          value: rosterEditDeadline,
          onChange: (e) => setRosterEditDeadline(e.target.value),
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-players' }, 'Maximálny počet hráčov v tíme'),
        React.createElement('input', {
          type: 'number',
          id: 'number-of-players',
          // Triedy a disabled stav sú určené pre povolenie/zablokovanie na základe isFrozenForEditing
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
          value: numberOfPlayers,
          onChange: (e) => setNumberOfPlayers(parseInt(e.target.value) || 0), // Prevod na číslo, default 0
          min: 0, // Minimálna hodnota
          disabled: isFrozenForEditing, // Zablokovanie inputu, ak už registrácia začala alebo skončila
        })
      ),
      React.createElement(
        'div',
        null,
        React.createElement('label', { className: 'block text-gray-700 text-sm font-bold mb-2', htmlFor: 'number-of-implementation-team' }, 'Maximálny počet členov realizačného tímu'),
        React.createElement('input', {
          type: 'number',
          id: 'number-of-implementation-team',
          // Triedy a disabled stav sú určené pre povolenie/zablokovanie na základe isFrozenForEditing
          className: `shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 ${isFrozenForEditing ? 'bg-gray-200 cursor-not-allowed' : ''}`, 
          value: numberOfImplementationTeam,
          onChange: (e) => setNumberOfImplementationTeam(parseInt(e.target.value) || 0), // Prevod na číslo, default 0
          min: 0, // Minimálna hodnota
          disabled: isFrozenForEditing, // Zablokovanie inputu, ak už registrácia začala alebo skončila
        })
      ),
      React.createElement(
        'button',
        {
          type: 'submit',
          className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline w-full transition-colors duration-200',
        },
        'Aktualizovať nastavenia'
      )
    ),

    // Sekcia: Nastavenia veľkostí tričiek
    React.createElement(
        'div',
        { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' }, // Oddelená sekcia s margin-top
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia veľkostí tričiek'),
        React.createElement(
            'div',
            { className: 'space-y-3' }, // Pre medzery medzi jednotlivými veľkosťami
            tshirtSizes.length > 0 ? (
                tshirtSizes.map((size, index) => (
                    React.createElement(
                        'div',
                        { key: size, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, size),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenEditSizeModal(size),
                                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Upraviť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenConfirmDeleteModal(size),
                                    className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Vymazať'
                            )
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne veľkosti tričiek.')
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-center mt-4' }, // Zarovnanie tlačidla '+' na stred
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleOpenAddSizeModal,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full shadow-lg transition-colors duration-200 focus:outline-none focus:shadow-outline w-12 h-12 flex items-center justify-center' // Pridané w-12, h-12, flex, items-center, justify-center
                },
                React.createElement('span', { className: 'text-xl' }, '+')
            )
        )
    ),

    React.createElement(
        'div',
        { className: 'space-y-4 p-6 border border-gray-200 rounded-lg shadow-sm mt-8' }, // Oddelená sekcia s margin-top
        React.createElement('h2', { className: 'text-2xl font-semibold text-gray-700 mb-4' }, 'Nastavenia ubytovania'),
        React.createElement(
            'div',
            { className: 'space-y-3' }, // Pre medzery medzi jednotlivými typmi ubytovania
            accommodations.length > 0 ? (
                accommodations.map((acc, index) => (
                    React.createElement(
                        'div',
                        { key: acc.type, className: 'flex justify-between items-center bg-gray-50 p-3 rounded-md shadow-sm' },
                        React.createElement('span', { className: 'text-gray-800 font-medium' }, `${acc.type} (Kapacita: ${acc.capacity})`),
                        React.createElement(
                            'div',
                            { className: 'flex space-x-2' },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenEditAccommodationModal(acc),
                                    className: 'bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Upraviť'
                            ),
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    onClick: () => handleOpenConfirmDeleteAccommodationModal(acc),
                                    className: 'bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1 px-3 rounded-lg transition-colors duration-200 focus:outline-none focus:shadow-outline'
                                },
                                'Vymazať'
                            )
                        )
                    )
                ))
            ) : (
                React.createElement('p', { className: 'text-gray-500 text-center' }, 'Zatiaľ nie sú definované žiadne typy ubytovania.')
            )
        ),
        React.createElement(
            'div',
            { className: 'flex justify-center mt-4' }, // Zarovnanie tlačidla '+' na stred
            React.createElement(
                'button',
                {
                    type: 'button',
                    onClick: handleOpenAddAccommodationModal,
                    className: 'bg-green-500 hover:bg-green-600 text-white font-bold p-3 rounded-full shadow-lg transition-colors duration-200 focus:outline-none focus:shadow-outline w-12 h-12 flex items-center justify-center'
                },
                React.createElement('span', { className: 'text-xl' }, '+')
            )
        )
    ),

    // Modálne okno pre pridanie/úpravu veľkosti trička
    showSizeModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, modalMode === 'add' ? 'Pridať novú veľkosť' : `Upraviť veľkosť: ${currentSizeEdit}`),
        React.createElement(
          'input',
          {
            type: 'text',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte názov veľkosti (napr. S, M, 134-140)',
            value: newSizeValue,
            onChange: (e) => setNewSizeValue(e.target.value),
          }
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseSizeModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleSaveSize,
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            modalMode === 'add' ? 'Pridať' : 'Uložiť'
          )
        )
      )
    ),

    // Modálne okno na potvrdenie zmazania veľkosti trička
    showConfirmDeleteModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať veľkosť "${sizeToDelete}"?`),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseConfirmDeleteModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleDeleteSize,
              className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zmazať'
          )
        )
      )
    ),

    showAccommodationModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, accommodationModalMode === 'add' ? 'Pridať nový typ ubytovania' : `Upraviť typ ubytovania: ${currentAccommodationEdit?.type}`),
        React.createElement(
          'input',
          {
            type: 'text',
            className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
            placeholder: 'Zadajte typ ubytovania (napr. Hotel, Škola)',
            value: newAccommodationType,
            onChange: (e) => setNewAccommodationType(e.target.value),
          }
        ),
        React.createElement(
            'input',
            {
              type: 'number',
              className: 'shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 mb-4',
              placeholder: 'Zadajte kapacitu',
              value: newAccommodationCapacity,
              onChange: (e) => setNewAccommodationCapacity(parseInt(e.target.value) || 0), // Prevod na číslo, default 0
              min: 0,
            }
          ),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseAccommodationModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleSaveAccommodation,
              className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            accommodationModalMode === 'add' ? 'Pridať' : 'Uložiť'
          )
        )
      )
    ),

    {/* NOVÉ Modálne okno na potvrdenie zmazania ubytovania */}
    showConfirmDeleteAccommodationModal && React.createElement(
      'div',
      { className: 'modal' },
      React.createElement(
        'div',
        { className: 'modal-content' },
        React.createElement('h3', { className: 'text-xl font-bold mb-4' }, 'Potvrdiť zmazanie'),
        React.createElement('p', { className: 'text-gray-700 mb-6' }, `Naozaj chcete zmazať typ ubytovania "${accommodationToDelete?.type}" (kapacita: ${accommodationToDelete?.capacity})?`),
        React.createElement(
          'div',
          { className: 'flex justify-end space-x-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleCloseConfirmDeleteAccommodationModal,
              className: 'bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zrušiť'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: handleDeleteAccommodation,
              className: 'bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
            },
            'Zmazať'
          )
        )
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.TournamentSettingsApp = TournamentSettingsApp;
