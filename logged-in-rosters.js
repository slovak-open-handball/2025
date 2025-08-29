// logged-in-rosters.js
// Tento súbor predpokladá, že Firebase SDK verzie 9.x.x je inicializovaný v authentication.js
// a globálne funkcie ako window.auth, window.db, showGlobalLoader sú dostupné.

// Importy pre potrebné Firebase funkcie (modulárna syntax v9)
import { getFirestore, doc, onSnapshot, updateDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// Formátovanie dátumu na DD. MM. RRRR
const formatDateToDMMYYYY = (dateString) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    if (year && month && day) {
        return `${day}. ${month}. ${year}`;
    }
    return dateString;
};

// Mapovanie typov jedál na slovenské názvy a definovanie poradia
const mealTypeLabels = {
    breakfast: 'raňajky',
    lunch: 'obed',
    dinner: 'večera',
    refreshment: 'občerstvenie'
};

const mealOrder = ['breakfast', 'lunch', 'dinner', 'refreshment'];

// Skratky dní v týždni pre slovenčinu (0 = nedeľa, 1 = pondelok, ...)
const dayAbbreviations = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];


// Komponent modálneho okna pre úpravu tímu
function EditTeamModal({ show, onClose, teamData, onSaveTeam, userProfileData, availablePackages }) {
    // Tieto stavy sa stále inicializujú z teamData, ale input boxy sa pre ne nebudú renderovať.
    // Sú potrebné pre zostavenie updatedTeamData v handleSubmit.
    const [editedTeamName, setEditedTeamName] = React.useState(teamData ? teamData.teamName : '');
    const [editedCategoryName, setEditedCategoryName] = React.useState(teamData ? teamData.categoryName : '');
    // Nové stavy pre selectboxy
    const [editedArrivalType, setEditedArrivalType] = React.useState(teamData ? teamData.arrival?.type || 'bez dopravy' : 'bez dopravy');
    const [editedPackageName, setEditedPackageName] = React.useState(teamData ? teamData.packageDetails?.name || '' : '');
    
    // Stavy pre čas príchodu - hodiny a minúty
    const [editedArrivalHour, setEditedArrivalHour] = React.useState('');
    const [editedArrivalMinute, setEditedArrivalMinute] = React.useState('');


    // Aktualizácia stavu, keď sa zmenia teamData (napr. pri otvorení pre iný tím)
    React.useEffect(() => {
        if (teamData) {
            setEditedTeamName(teamData.teamName || '');
            setEditedCategoryName(teamData.categoryName || '');
            setEditedArrivalType(teamData.arrival?.type || 'bez dopravy');
            setEditedPackageName(teamData.packageDetails?.name || '');

            // Parsujeme čas na hodiny a minúty
            if (teamData.arrival?.time) {
                const [hour, minute] = teamData.arrival.time.split(':');
                setEditedArrivalHour(hour || '');
                setEditedArrivalMinute(minute || '');
            } else {
                setEditedArrivalHour('');
                setEditedArrivalMinute('');
            }
        }
    }, [teamData]);

    if (!show) return null;

    // Funkcia na získanie farby roly pre nadpis modálneho okna
    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff';
            case 'hall':
                return '#b06835';
            case 'user':
                return '#9333EA';
            default:
                return '#1D4ED8';
        }
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';


    const handleSubmit = async (e) => {
        e.preventDefault();

        let finalArrivalTime = '';
        if (editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus') {
            finalArrivalTime = `${editedArrivalHour.padStart(2, '0')}:${editedArrivalMinute.padStart(2, '0')}`;
        }

        const updatedTeamData = {
            ...teamData,
            teamName: editedTeamName, // Použijeme pôvodný názov tímu, lebo sa neupravuje
            categoryName: editedCategoryName, // Použijeme pôvodnú kategóriu, lebo sa neupravuje
            // Aktualizácia typu dopravy a času príchodu
            arrival: { 
                ...teamData.arrival, 
                type: editedArrivalType,
                time: finalArrivalTime
            },
            // Aktualizácia názvu balíka
            packageDetails: { ...teamData.packageDetails, name: editedPackageName }
            // Ostatné počty členov/šoférov sa zatiaľ neupravujú cez toto modálne okno
        };
        await onSaveTeam(updatedTeamData);
        onClose();
    };

    const showArrivalTimeInputs = editedArrivalType === 'verejná doprava - vlak' || editedArrivalType === 'verejná doprava - autobus';

    // Generovanie možností pre hodiny (00-23)
    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    // Generovanie možností pre minúty (00-59)
    const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center' },
        React.createElement(
            'div',
            { className: 'relative p-8 bg-white w-full max-w-md mx-auto rounded-lg shadow-lg' },
            React.createElement(
                'div',
                { className: `flex justify-between items-center text-white p-4 -mx-8 -mt-8 mb-4 rounded-t-lg`, style: { backgroundColor: roleColor } },
                React.createElement('h3', { className: 'text-2xl font-semibold' }, `Upraviť tím: ${teamData.teamName}`),
                React.createElement(
                    'button',
                    { onClick: onClose, className: 'text-white hover:text-gray-200 text-3xl leading-none font-semibold' },
                    '×'
                )
            ),
            React.createElement(
                'form',
                { onSubmit: handleSubmit, className: 'space-y-4' },
                // Odstránené input boxy pre Názov tímu a Kategóriu
                
                // Selectbox pre Typ dopravy
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'arrivalType', className: 'block text-sm font-medium text-gray-700' }, 'Typ dopravy'),
                    React.createElement('select', {
                        id: 'arrivalType',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedArrivalType,
                        onChange: (e) => setEditedArrivalType(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: 'bez dopravy' }, 'bez dopravy'),
                    React.createElement('option', { value: 'verejná doprava - autobus' }, 'verejná doprava - autobus'),
                    React.createElement('option', { value: 'verejná doprava - vlak' }, 'verejná doprava - vlak'),
                    React.createElement('option', { value: 'vlastná doprava' }, 'vlastná doprava')
                    )
                ),
                // Podmienené zobrazenie selectboxov pre čas príchodu
                showArrivalTimeInputs && React.createElement(
                    'div',
                    null, // Nový div kontajner pre nadpis a selectboxy
                    React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Plánovaný čas príchodu na turnaj'), // Popisok
                    React.createElement(
                        'div',
                        { className: 'flex space-x-2' },
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalHour', className: 'block text-sm font-medium text-gray-700' }, 'Hodina'), // Zviditeľnený popisok
                            React.createElement('select', {
                                id: 'arrivalHour',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalHour,
                                onChange: (e) => setEditedArrivalHour(e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, '-- Hodina --'), // Predvolená prázdna hodnota s popisom
                            hourOptions.map((hour) =>
                                React.createElement('option', { key: hour, value: hour }, hour)
                            )
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'w-1/2' },
                            React.createElement('label', { htmlFor: 'arrivalMinute', className: 'block text-sm font-medium text-gray-700' }, 'Minúta'), // Zviditeľnený popisok
                            React.createElement('select', {
                                id: 'arrivalMinute',
                                className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                                value: editedArrivalMinute,
                                onChange: (e) => setEditedArrivalMinute(e.target.value),
                                required: true
                            },
                            React.createElement('option', { value: '' }, '-- Minúta --'), // Predvolená prázdna hodnota s popisom
                            minuteOptions.map((minute) =>
                                React.createElement('option', { key: minute, value: minute }, minute)
                            )
                            )
                        )
                    )
                ),
                // Selectbox pre Balík
                React.createElement(
                    'div',
                    null,
                    React.createElement('label', { htmlFor: 'packageName', className: 'block text-sm font-medium text-gray-700' }, 'Balík'),
                    React.createElement('select', {
                        id: 'packageName',
                        className: 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2',
                        value: editedPackageName,
                        onChange: (e) => setEditedPackageName(e.target.value),
                        required: true
                    },
                    React.createElement('option', { value: '' }, 'Vyberte balík'), // Defaultná prázdna možnosť
                    availablePackages.slice().sort().map((pkgName, idx) => // Zoradenie balíkov abecedne
                        React.createElement('option', { key: idx, value: pkgName }, pkgName)
                    )
                    )
                ),

                React.createElement(
                    'div',
                    { className: 'flex justify-end space-x-2 mt-6' },
                    React.createElement(
                        'button',
                        {
                            type: 'button',
                            onClick: onClose,
                            className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors'
                        },
                        'Zrušiť'
                    ),
                    React.createElement(
                        'button',
                        {
                            type: 'submit',
                            className: `px-4 py-2 text-white rounded-md transition-colors`,
                            style: { backgroundColor: roleColor, hoverBackgroundColor: roleColor }
                        },
                        'Uložiť zmeny'
                    )
                )
            )
        )
    );
}


// Main React component for the logged-in-rosters.html page
function RostersApp() {
  const auth = getAuth(); 
  const db = getFirestore();     

  const [user, setUser] = React.useState(null); 
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); 
  const [teamsData, setTeamsData] = React.useState({}); // Nový stav pre dáta tímov
  const [showEditTeamModal, setShowEditTeamModal] = React.useState(false); // Stav pre modálne okno
  const [selectedTeam, setSelectedTeam] = React.useState(null); // Stav pre vybraný tím na úpravu
  const [availablePackages, setAvailablePackages] = React.useState([]); // Nový stav pre balíky z databázy

  // Loading stav pre používateľský profil
  const [loading, setLoading] = React.useState(true); 

  // Používateľské ID pre Firebase App ID
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; 

  React.useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setIsAuthReady(true); 
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

  // Načítanie zoznamu balíkov z Firestore
  React.useEffect(() => {
      let unsubscribePackages;
      if (db) {
          try {
              const packagesRef = collection(db, 'settings', 'packages', 'list');
              unsubscribePackages = onSnapshot(packagesRef, (snapshot) => {
                  const packagesList = [];
                  snapshot.forEach(doc => {
                      const data = doc.data();
                      if (data.name) {
                          packagesList.push(data.name);
                      }
                  });
                  setAvailablePackages(packagesList);
                  console.log("RostersApp: Packages loaded:", packagesList);
              }, (error) => {
                  console.error("RostersApp: Error fetching packages:", error);
              });
          } catch (e) {
              console.error("RostersApp: Error setting up onSnapshot for packages:", e);
          }
      }
      return () => {
          if (unsubscribePackages) {
              unsubscribePackages();
          }
      };
  }, [db]);


  React.useEffect(() => {
    let unsubscribeUserDoc;

    if (user && db && isAuthReady) {
      console.log(`RostersApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
      setLoading(true); 

      try {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, docSnapshot => { 
          if (docSnapshot.exists()) { 
            const userData = docSnapshot.data();
            console.log("RostersApp: Používateľský dokument existuje, dáta:", userData); // Log celej dátovej štruktúry
            setUserProfileData(userData);
            
            // Extrahovanie a nastavenie dát tímov
            if (userData.teams) {
                setTeamsData(userData.teams);
            } else {
                setTeamsData({}); // Ak teams neexistuje, nastavíme prázdny objekt
            }

            setLoading(false);
          } else {
            console.warn("RostersApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
            setLoading(false);
          }
        }, error => {
          console.error("RostersApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
          setLoading(false);
        });
      } catch (e) {
        console.error("RostersApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
        setLoading(false);
      }
    } else if (isAuthReady && user === null) {
        setLoading(false);
        setUserProfileData(null);
        setTeamsData({});
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

  // Helper funkcia na konsolidáciu všetkých členov tímu do jedného poľa
  const getAllTeamMembers = (team) => {
    const members = [];

    // Hráči
    if (team.playerDetails && team.playerDetails.length > 0) {
      team.playerDetails.forEach(player => {
        members.push({
          type: 'Hráč',
          firstName: player.firstName,
          lastName: player.lastName,
          jerseyNumber: player.jerseyNumber,
          address: player.address // Pridanie adresy
        });
      });
    }

    // Členovia realizačného tímu (muži)
    if (team.menTeamMemberDetails && team.menTeamMemberDetails.length > 0) {
      team.menTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (muž)',
          firstName: member.firstName,
          lastName: member.lastName,
          address: member.address // Pridanie adresy
        });
      });
    }

    // Členky realizačného tímu (ženy)
    if (team.womenTeamMemberDetails && team.womenTeamMemberDetails.length > 0) {
      team.womenTeamMemberDetails.forEach(member => {
        members.push({
          type: 'Člen realizačného tímu (žena)',
          firstName: member.firstName,
          lastName: member.lastName,
          address: member.address // Pridanie adresy
        });
      });
    }

    // Šofér (žena)
    if (team.driverDetailsFemale && team.driverDetailsFemale.length > 0) {
      team.driverDetailsFemale.forEach(driver => {
        members.push({
          type: 'Šofér (žena)',
          firstName: driver.firstName,
          lastName: driver.lastName,
          address: driver.address // Pridanie adresy
        });
      });
    }

    // Šofér (muž)
    if (team.driverDetailsMale && team.driverDetailsMale.length > 0) {
      team.driverDetailsMale.forEach(driver => {
        members.push({
          type: 'Šofér (muž)',
          firstName: driver.firstName,
          lastName: driver.lastName,
          address: driver.address // Pridanie adresy
        });
      });
    }

    return members;
  };

  // Prevod objektu teamsData na pole pre jednoduchšie mapovanie vo React komponente
  // A zoradenie kategórií podľa názvu abecedne
  const teamCategories = Object.entries(teamsData).sort((a, b) => a[0].localeCompare(b[0]));

  // Helper funkcia na skloňovanie slova "tím"
  const getTeamPluralization = (count) => {
    if (count === 1) {
      return 'tím';
    } else if (count >= 2 && count <= 4) {
      return 'tímy';
    } else {
      return 'tímov';
    }
  };

  // Funkcia pre otvorenie modálneho okna na úpravu tímu
  const handleOpenEditTeamModal = (team) => {
    setSelectedTeam({ ...team, categoryName: team.categoryName }); // Uložíme celý tím a jeho kategóriu
    setShowEditTeamModal(true);
  };

  // Funkcia pre uloženie zmien tímu
  const handleSaveTeam = async (updatedTeamData) => {
    if (!user || !user.uid) {
        showLocalNotification('Chyba: Používateľ nie je prihlásený.', 'error');
        return;
    }

    // Predpokladáme, že updatedTeamData obsahuje všetky upravené polia
    // Potrebujeme nájsť správny tím v rámci user.teams[categoryName]
    // A aktualizovať ho vo Firestore
    const teamCategory = updatedTeamData.categoryName;
    const teamIndex = teamsData[teamCategory].findIndex(t => t.teamName === updatedTeamData.teamName);

    if (teamIndex !== -1) {
        const userDocRef = doc(db, 'users', user.uid);
        const currentTeams = { ...teamsData }; // Kópia existujúcich tímov

        // Vytvorenie novej štruktúry pre aktualizáciu konkrétneho tímu v rámci kategórie
        currentTeams[teamCategory][teamIndex] = updatedTeamData;

        try {
            await updateDoc(userDocRef, {
                teams: currentTeams
            });
            showLocalNotification('Údaje tímu boli úspešne aktualizované!', 'success');
        } catch (error) {
            console.error("Chyba pri aktualizácii tímu:", error);
            showLocalNotification('Nastala chyba pri aktualizácii údajov tímu.', 'error');
        }
    } else {
        showLocalNotification('Chyba: Tím nebol nájdený pre aktualizáciu.', 'error');
    }
};

    // Funkcia na získanie farby roly pre nadpis
    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff';
            case 'hall':
                return '#b06835';
            case 'user':
                return '#9333EA'; // Používateľ má fialovú
            default:
                return '#1D4ED8';
        }
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';


  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col font-inter overflow-y-auto w-full' }, // Odstránené 'items-center'
    React.createElement(
      'div',
      { className: 'w-full p-4' }, // Odstránené 'max-w-3xl' aby sa to správalo ako v all-registrations.html
      // Odstránené triedy pre biely podklad a tieň z hlavného kontajnera
      React.createElement(
        'div',
        { className: 'w-full' }, 
//        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
//          'Súpiska tímov'
//        ),
        
        teamCategories.length > 0 ? (
          React.createElement('div', { className: 'space-y-6 w-full' }, // Pridané w-full
            teamCategories.map(([categoryName, teamsArray]) => (
              // Kontajner kategórie s nadpisom
              React.createElement('div', { key: categoryName, className: 'space-y-4 w-full' }, // Pridané w-full
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800 mb-4' }, `${categoryName} (${teamsArray.length} ${getTeamPluralization(teamsArray.length)})`), // Väčší a tučnejší nadpis
                React.createElement('div', { className: 'space-y-6 w-full' }, // Pridané w-full
                  teamsArray.map((team, index) => {
                    const allMembers = getAllTeamMembers(team);
                    
                    // Extrahovanie informácií o doprave, ubytovaní a balíku
                    const arrivalType = team.arrival?.type || 'Nezadané';
                    const accommodationType = team.accommodation?.type || 'Nezadané'; 
                    const packageName = team.packageDetails?.name || 'Nezadané';
                    
                    // Upravená podmienka pre čas príchodu s pridaným "hod."
                    const arrivalTime = (
                        (arrivalType === "verejná doprava - autobus" || arrivalType === "verejná doprava - vlak") && team.arrival?.time
                    ) ? ` (čas: ${team.arrival.time} hod.)` : '';

                    // Určenie, či zobraziť stĺpec Adresa
                    const shouldShowAddressColumn = accommodationType !== 'bez ubytovania';

                    // Helper funkcia na formátovanie adresy
                    const formatAddress = (address) => {
                        if (!address) return '-';
                        const parts = [];
                        if (address.street && address.houseNumber) {
                            parts.push(`${address.street} ${address.houseNumber}`);
                        } else if (address.street) {
                            parts.push(address.street);
                        } else if (address.houseNumber) {
                            parts.push(address.houseNumber);
                        }
                        if (address.postalCode && address.city) {
                            parts.push(`${address.postalCode} ${address.city}`);
                        } else if (address.postalCode) {
                            parts.push(address.postalCode);
                        } else if (address.city) {
                            parts.push(address.city);
                        }
                        if (address.country) {
                            parts.push(address.country);
                        }
                        return parts.length > 0 ? parts.join(', ') : '-';
                    };

                    // Každý tím bude mať svoj vlastný biely obdĺžnik s tieňom a fialovým okrajom
                    return React.createElement('div', { 
                        key: index, 
                        className: 'bg-white pb-6 rounded-lg shadow-md border-l-4 border-[#9333EA] mb-4 w-full' // Pridané w-full
                    }, 
                      // Kontajner pre fialový pásik a texty kategórie a názvu tímu
                      // Pridal som flexbox a justify-between pre zarovnanie nadpisu a tlačidla
                      React.createElement('div', { className: `bg-[#9333EA] text-white py-2 px-6 rounded-t-lg w-full flex justify-between items-center` }, // Upravené
                        React.createElement('p', { className: 'text-xl font-semibold' }, `Názov tímu: ${team.teamName || 'Neznámy tím'}`), // Zmenený poriadok, aby bol nadpis hlavný
                        React.createElement(
                            'button',
                            {
                                onClick: () => handleOpenEditTeamModal({ ...team, categoryName: categoryName }),
                                className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                                'aria-label': 'Upraviť tím',
                                style: { color: roleColor }
                            },
                            React.createElement(
                                'svg',
                                { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                            ),
                            React.createElement('span', { className: 'font-medium' }, 'Upraviť')
                        )
                      ),
                      
                      // Kontajner pre ostatný obsah pod fialovým pásikom s polstrovaním
                      React.createElement('div', { className: 'px-6 pt-4 w-full' }, // Pridané w-full
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Kategória: ${categoryName}`), // Kategória premiestnená
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Počet hráčov: ${team.players || 0}`), 
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Členovia realizačného tímu (ženy): ${team.womenTeamMembers || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Členovia realizačného tímu (muži): ${team.menTeamMembers || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Šoféri (ženy): ${team.driverDetailsFemale?.length || 0}`),
                        React.createElement('p', { className: 'text-md text-gray-700 mb-2' }, `Šoféri (muži): ${team.driverDetailsMale?.length || 0}`),
                        
                        // Nové informácie o doprave, ubytovaní a balíku
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Typ dopravy: ${arrivalType}${arrivalTime}`), 
                        React.createElement('p', { className: 'text-md text-gray-700' }, `Typ ubytovania: ${accommodationType}`), 
                        
                        // Zobrazenie detailov balíka
                        team.packageDetails && React.createElement(
                            'div',
                            { className: 'mt-2 mb-4' }, // upravené marginy
                            React.createElement('p', { className: 'text-md text-gray-700' }, `Balík: ${packageName}`),
                            React.createElement(
                                'div',
                                { className: 'ml-4 mt-2 mb-4 space-y-1' }, // Odsadenie a priestor pre detaily
                                React.createElement('p', { className: 'text-sm text-gray-600' }, `Cena balíka: ${team.packageDetails.price || 0} € / osoba`), // Upravený text
                                // Úprava pre zobrazenie Účastníckej karty
                                // Teraz kontrolujeme, či je 'participantCard' kľúčom v meals a má hodnotu 1
                                team.packageDetails.meals && team.packageDetails.meals.participantCard === 1 && React.createElement(
                                    'p',
                                    { className: 'text-sm text-gray-600' },
                                    `Zahŕňa účastnícku kartu` 
                                ),
                                team.packageDetails.meals && (() => {
                                    // Získanie filtrovaných a zoradených dátumov s aktívnymi jedlami
                                    const activeMealDates = Object.keys(team.packageDetails.meals).sort().filter(key => {
                                        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(key);
                                        return isValidDate && key !== 'participantCard' && Object.values(team.packageDetails.meals[key]).some(status => status === 1);
                                    });

                                    // Ak existujú nejaké aktívne stravovacie dni, zobrazíme nadpis a zoznam
                                    if (activeMealDates.length > 0) {
                                        return React.createElement(
                                            'div',
                                            { className: 'mt-2' },
                                            React.createElement('p', { className: 'text-sm text-gray-600 font-semibold' }, 'Stravovanie:'),
                                            activeMealDates.map(date => {
                                                const dateObj = new Date(date);
                                                const dayIndex = dateObj.getDay(); // 0 = nedeľa, 1 = pondelok, ...
                                                const dayAbbr = dayAbbreviations[dayIndex];

                                                const activeMeals = mealOrder
                                                    .filter(mealType => team.packageDetails.meals[date][mealType] === 1)
                                                    .map(mealType => mealTypeLabels[mealType]); // Používame priamo mealTypeLabels, ktoré sú už malými písmenami

                                                const activeMealsString = activeMeals.join(', ');

                                                return React.createElement(
                                                    'p',
                                                    { key: date, className: 'text-sm text-gray-600 ml-2' },
                                                    `${dayAbbr} ${formatDateToDMMYYYY(date)}: ${activeMealsString}`
                                                );
                                            })
                                        );
                                    }
                                    return null; // Ak nie sú žiadne aktívne stravovacie dni, nezobrazíme nič
                                })()
                            )
                        ),
                        // Zobrazenie veľkostí a počtu tričiek
                        team.tshirts && team.tshirts.length > 0 && (
                            React.createElement('div', { className: 'mb-4 w-full' }, // Pridané w-full
                                React.createElement('p', { className: 'text-md text-gray-700 font-semibold mb-1' }, 'Tričká:'),
                                team.tshirts.map((tshirt, tIndex) => (
                                    React.createElement('p', { key: tIndex, className: 'text-md text-gray-700 ml-4' }, 
                                        `Veľkosť: ${tshirt.size}, Počet: ${tshirt.quantity}`
                                    )
                                ))
                            )
                        )
                      ), // Koniec kontajnera pre obsah
                      

                      allMembers.length > 0 && (
                        React.createElement('div', { className: 'mt-4 px-6 w-full' }, // Pridané w-full
                          React.createElement('h4', { className: 'text-lg font-bold text-gray-800 mb-3' }, 'Zoznam členov:'),
                          // Vraciam overflow-x-auto, aby sa tabuľka skrolovala, ak je príliš široká
                          React.createElement('div', { className: 'overflow-x-auto w-full' }, // Pridané w-full
                            React.createElement('table', { className: 'min-w-full bg-white border border-gray-200 rounded-lg' },
                              React.createElement('thead', null,
                                React.createElement('tr', { className: 'bg-gray-100 text-left text-sm font-medium text-gray-600 uppercase tracking-wider' },
                                  [
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Typ člena'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Číslo dresu'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Meno'),
                                    React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Priezvisko'),
                                    // Podmienené zobrazenie stĺpca Adresa
                                    shouldShowAddressColumn && React.createElement('th', { className: 'py-3 px-4 border-b-2 border-gray-200 whitespace-nowrap' }, 'Adresa'),
                                  ].filter(Boolean) // Filter out 'false' values
                                )
                              ),
                              React.createElement('tbody', { className: 'divide-y divide-gray-200' },
                                allMembers.map((member, mIndex) => (
                                  React.createElement('tr', { key: mIndex, className: 'hover:bg-gray-50' },
                                    [
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.type),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-600' }, member.jerseyNumber || '-'),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.firstName || '-'),
                                      React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, member.lastName || '-'),
                                      // Podmienené zobrazenie bunky s adresou
                                      shouldShowAddressColumn && React.createElement('td', { className: 'py-3 px-4 whitespace-nowrap text-sm text-gray-800' }, formatAddress(member.address)),
                                    ].filter(Boolean) // Filter out 'false' values
                                  )
                                ))
                              )
                            )
                          )
                        )
                      )
                    )
                  })
                )
              )
            ))
          )
        ) : (
          React.createElement('p', { className: 'text-center text-gray-600 text-lg py-8' }, 'Zatiaľ neboli vytvorené žiadne tímy pre tohto používateľa.')
        )
      ),
      // Modálne okno pre úpravu tímu
      selectedTeam && React.createElement(
        EditTeamModal,
        {
          show: showEditTeamModal,
          onClose: () => setShowEditTeamModal(false),
          teamData: selectedTeam,
          onSaveTeam: handleSaveTeam,
          userProfileData: userProfileData, // Pre farbu nadpisu
          availablePackages: availablePackages // Odovzdanie zoznamu balíkov
        }
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.RostersApp = RostersApp;
