// logged-in-all-registrations.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-all-registrations.html.

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// NotificationModal Component for displaying temporary messages (converted to React.createElement)
// Pridaný prop 'displayNotificationsEnabled'
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
  const [show, setShow] = React.useState(false);
  const timerRef = React.useRef(null);

  React.useEffect(() => {
    // Zobrazí notifikáciu len ak je správa A notifikácie sú povolené
    if (message && displayNotificationsEnabled) {
      setShow(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 500);
      }, 10000);
    } else {
      setShow(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, onClose, displayNotificationsEnabled]); // Závisí aj od displayNotificationsEnabled

  // Nezobrazovať notifikáciu, ak nie je správa ALEBO ak sú notifikácie zakázané
  if ((!show && !message) || !displayNotificationsEnabled) return null;

  return React.createElement(
    'div',
    {
      className: `fixed top-0 left-0 right-0 z-50 flex justify-center p-4 transition-transform duration-500 ease-out ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`,
      style: { pointerEvents: 'none' }
    },
    React.createElement(
      'div',
      {
        className: 'bg-[#3A8D41] text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center',
        style: { pointerEvents: 'auto' }
      },
      React.createElement('p', { className: 'font-semibold' }, message)
    )
  );
}

// FilterModal Component - Modálne okno pre filtrovanie s viacnásobným výberom
function FilterModal({ isOpen, onClose, columnName, onApplyFilter, initialFilterValues, onClearFilter, uniqueColumnValues }) {
    // selectedValues je teraz pole pre viacnásobný výber
    // initialFilterValues už obsahujú hodnoty v malých písmenách, takže ich len použijeme
    const [selectedValues, setSelectedValues] = React.useState(initialFilterValues || []);

    React.useEffect(() => {
        // Inicializovať selectedValues pri otvorení modalu alebo zmene initialFilterValues
        // Zabezpečí, že pri opätovnom otvorení modalu sa nastavia správne začiarknuté polia
        setSelectedValues(initialFilterValues || []);
    }, [initialFilterValues, isOpen]);

    if (!isOpen) return null;

    const handleCheckboxChange = (value) => {
        // KĽÚČOVÁ ZMENA: Prevod hodnoty na malé písmená pre konzistentné porovnávanie
        const lowerCaseValue = String(value).toLowerCase();
        setSelectedValues(prev => {
            if (prev.includes(lowerCaseValue)) {
                return prev.filter(item => item !== lowerCaseValue); // Odstrániť, ak už je vybrané
            } else {
                return [...prev, lowerCaseValue]; // Pridať, ak nie je vybrané
            }
        });
    };

    const handleApply = () => {
        onApplyFilter(columnName, selectedValues);
        onClose();
    };

    const handleClear = () => {
        setSelectedValues([]);
        onClearFilter(columnName);
        onClose();
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'bg-white p-6 rounded-lg shadow-xl w-full max-w-sm' },
            React.createElement('h3', { className: 'text-lg font-semibold mb-4' }, `Filter pre ${columnName}`),
            React.createElement(
                'div',
                { className: 'max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-md p-2' },
                uniqueColumnValues.map((value, index) =>
                    React.createElement(
                        'div',
                        { key: index, className: 'flex items-center mb-2' },
                        React.createElement('input', {
                            type: 'checkbox',
                            id: `filter-${columnName}-${index}`,
                            value: value,
                            checked: selectedValues.includes(String(value).toLowerCase()), // Kontrola na malé písmená
                            onChange: () => handleCheckboxChange(value),
                            className: 'mr-2'
                        }),
                        React.createElement('label', { htmlFor: `filter-${columnName}-${index}` }, value || '(Prázdne)')
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement('button', {
                    className: 'px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300',
                    onClick: onClose
                }, 'Zrušiť'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600',
                    onClick: handleClear
                }, 'Vymazať filter'),
                React.createElement('button', {
                    className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600',
                    onClick: handleApply
                }, 'Použiť filter')
            )
        )
    );
}

// Main React component for the logged-in-all-registrations.html page
function AllRegistrationsApp() { // Zmena: MyDataApp na AllRegistrationsApp
  const [app, setApp] = React.useState(null);
  const [auth, setAuth] = React.useState(null);
  const [db, setDb] = React.useState(null);
  const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
  // Nový stav pre dáta používateľského profilu z Firestore
  const [userProfileData, setUserProfileData] = React.useState(null); 
  const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

  // User Data States - Tieto stavy sa budú aktualizovať z userProfileData
  const [role, setRole] = React.useState('');
  const [isApproved, setIsApproved] = React.useState(false);

  // Deklarácia stavov pre používateľov a filtrovanie
  const [allUsers, setAllUsers] = React.useState([]); 
  const [filteredUsers, setFilteredUsers] = React.useState([]);
  const [currentSort, setCurrentSort] = React.useState({ column: 'registrationDate', direction: 'desc' });
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [filterColumn, setFilterColumn] = React.useState('');
  const [activeFilters, setActiveFilters] = React.useState({});
  const [uniqueColumnValues, setUniqueColumnValues] = React.useState([]);


  // Effect for Firebase initialization and Auth Listener setup (runs only once)
  React.useEffect(() => {
    let unsubscribeAuth;
    let firestoreInstance;

    try {
      if (typeof firebase === 'undefined') {
        console.error("AllRegistrationsApp: Firebase SDK nie je načítané."); // Zmena logu
        setError("Firebase SDK nie je načítané. Skontrolujte logged-in-all-registrations.html."); // Zmena logu
        setLoading(false);
        return;
      }

      const firebaseApp = firebase.app();
      setApp(firebaseApp);

      const authInstance = firebase.auth(firebaseApp);
      setAuth(authInstance);
      firestoreInstance = firebase.firestore(firebaseApp);
      setDb(firestoreInstance);

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await authInstance.signInWithCustomToken(initialAuthToken);
          }
          // Ak initialAuthToken nie je k dispozícii, jednoducho sa spoliehame na onAuthStateChanged,
          // ktoré detekuje pretrvávajúci stav prihlásenia (napr. z login.html).
        } catch (e) {
          console.error("AllRegistrationsApp: Chyba pri počiatočnom prihlásení Firebase (s custom tokenom):", e); // Zmena logu
          setError(`Chyba pri prihlásení: ${e.message}`);
        }
      };

      unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
        console.log("AllRegistrationsApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null"); // Zmena logu
        setUser(currentUser); // Nastaví Firebase User objekt
        setIsAuthReady(true); // Mark auth as ready after the first check
      });

      signIn();

      return () => {
        if (unsubscribeAuth) {
          unsubscribeAuth();
        }
      };
    } catch (e) {
      console.error("AllRegistrationsApp: Nepodarilo sa inicializovať Firebase:", e); // Zmena logu
      setError(`Chyba pri inicializácii Firebase: ${e.message}`);
      setLoading(false);
    }
  }, []);

  // NOVÝ EFFECT: Načítanie používateľských dát z Firestore po inicializácii Auth a DB
  React.useEffect(() => {
    let unsubscribeUserDoc;

    // Spustí sa len ak je Auth pripravené, DB je k dispozícii a user je definovaný (nie undefined)
    if (isAuthReady && db && user !== undefined) {
      if (user === null) { // Ak je používateľ null (nie je prihlásený), presmeruj
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
        window.location.href = 'login.html';
        return;
      }

      // Ak je používateľ prihlásený, pokús sa načítať jeho dáta z Firestore
      if (user) {
        console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`); // Zmena logu
        // Nastavíme loading na true, pretože začíname načítavať profilové dáta
        setLoading(true); // Nastavíme loading na true tu

        try {
          const userDocRef = db.collection('users').doc(user.uid);
          unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
              const userData = docSnapshot.data();
              console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData); // Zmena logu

              // --- OKAMŽITÉ ODHLÁSENIE, AK passwordLastChanged NIE JE PLATNÝ TIMESTAMP ---
              // Toto je pridaná logika, ktorá sa spustí hneď po načítaní dát.
              // Ak je passwordLastChanged neplatný alebo chýba, odhlásiť.
              if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                  console.error("AllRegistrationsApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged); // Zmena logu
                  console.log("AllRegistrationsApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(`passwordLastChanged_${user.uid}`); // Vyčistíme localStorage
                  return; // Zastaviť ďalšie spracovanie
              }

              // Normal processing if passwordLastChanged is valid
              const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
              const localStorageKey = `passwordLastChanged_${user.uid}`;
              let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

              console.log(`AllRegistrationsApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`); // Zmena logu

              if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                  // First load for this user/browser, initialize localStorage and do NOT logout
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AllRegistrationsApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie)."); // Zmena logu
                  // No return here, continue with normal data processing for the first load
              } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                  // Password was changed on another device/session
                  console.log("AllRegistrationsApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey); // Clear localStorage after logout
                  return;
              } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                  // This should ideally not happen if Firestore is the source of truth
                  console.warn("AllRegistrationsApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad)."); // Zmena logu
                  auth.signOut(); // Používame auth z React stavu
                  window.location.href = 'login.html';
                  localStorage.removeItem(localStorageKey);
                  return;
              } else {
                  // Times are equal, ensure localStorage is up-to-date
                  localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                  console.log("AllRegistrationsApp: Timestampy sú rovnaké, aktualizujem localStorage."); // Zmena logu
              }

              setUserProfileData(userData); // Aktualizujeme stav userProfileData
              setLoading(false); // Stop loading po načítaní používateľských dát
              setError(''); // Vymazať chyby po úspešnom načítaní

              // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
              if (typeof updateMenuItemsVisibility === 'function') {
                  updateMenuItemsVisibility(userData.role);
              } else {
                  console.warn("AllRegistrationsApp: Funkcia updateMenuItemsVisibility nie je definovaná."); // Zmena logu
              }

              console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené, loading: false"); // Zmena logu
            } else {
              console.warn("AllRegistrationsApp: Používateľský dokument sa nenašiel pre UID:", user.uid); // Zmena logu
              setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
              setLoading(false); // Zastaví načítavanie, aby sa zobrazila chyba
            }
          }, error => {
            console.error("AllRegistrationsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error); // Zmena logu
            if (error.code === 'permission-denied') {
                setError(`Chyba oprávnení: Nemáte prístup k svojmu profilu. Skúste sa prosím znova prihlásiť alebo kontaktujte podporu.`);
            } else if (error.code === 'unavailable') {
                setError(`Chyba pripojenia: Služba Firestore je nedostupná. Skúste to prosím neskôr.`);
            } else if (error.code === 'unauthenticated') {
                 setError(`Chyba autentifikácie: Nie ste prihlásený. Skúste sa prosím znova prihlásiť.`);
                 if (auth) {
                    auth.signOut();
                    window.location.href = 'login.html';
                 }
            } else {
                setError(`Chyba pri načítaní používateľských dát: ${error.message}`);
            }
            setLoading(false); // Stop loading aj pri chybe
            console.log("AllRegistrationsApp: Načítanie používateľských dát zlyhalo, loading: false"); // Zmena logu
          });
        } catch (e) {
          console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e); // Zmena logu
          setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
          setLoading(false); // Stop loading aj pri chybe
        }
      }
    } else if (isAuthReady && user === undefined) {
        console.log("AllRegistrationsApp: Auth ready, user undefined. Nastavujem loading na false."); // Zmena logu
        setLoading(false);
    }


    return () => {
      // Zrušíme odber onSnapshot pri unmount
      if (unsubscribeUserDoc) {
        console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument."); // Zmena logu
        unsubscribeUserDoc();
      }
    };
  }, [isAuthReady, db, user, auth]);

  // Effect for fetching all users from Firestore
  React.useEffect(() => {
    let unsubscribeAllUsers;
    // appId by mal byť globálne dostupný z HTML
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
        console.log("AllRegistrationsApp: Admin prihlásený a schválený. Načítavam všetkých používateľov.");
        setLoading(true);
        try {
            // Získanie všetkých používateľov z kolekcie 'users'
            unsubscribeAllUsers = db.collection('users').onSnapshot(snapshot => {
                const usersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log("AllRegistrationsApp: Všetci používatelia načítaní:", usersData);
                setAllUsers(usersData);
                setFilteredUsers(usersData); // Na začiatku sú filtrovaní používatelia rovnakí ako všetci
                setLoading(false);
                setUserNotificationMessage("Dáta registrácie boli úspešne načítané!"); // Zobrazenie notifikácie
            }, error => {
                console.error("AllRegistrationsApp: Chyba pri načítaní všetkých používateľov z Firestore:", error);
                setError(`Chyba pri načítaní používateľov: ${error.message}`);
                setLoading(false);
                setUserNotificationMessage(`Chyba pri načítaní dát: ${error.message}`); // Zobrazenie notifikácie
            });
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre všetkých používateľov:", e);
            setError(`Chyba pri načítaní používateľov: ${e.message}`);
            setLoading(false);
            setUserNotificationMessage(`Chyba pri načítaní dát: ${e.message}`); // Zobrazenie notifikácie
        }
    } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
        setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
        setLoading(false);
        console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Prístup zamietnutý.");
        setUserNotificationMessage("Nemáte oprávnenie na zobrazenie tejto stránky."); // Zobrazenie notifikácie
    } else if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Používateľ nie je prihlásený. Presmerovanie na login.html.");
        window.location.href = 'login.html';
    }

    return () => {
        if (unsubscribeAllUsers) {
            console.log("AllRegistrationsApp: Ruším odber onSnapshot pre všetkých používateľov.");
            unsubscribeAllUsers();
        }
    };
  }, [db, userProfileData, isAuthReady]); // Závisí od db a userProfileData


  // Sorting logic
  const handleSort = (column) => {
      let direction = 'asc';
      if (currentSort.column === column && currentSort.direction === 'asc') {
          direction = 'desc';
      }
      setCurrentSort({ column, direction });

      const sorted = [...filteredUsers].sort((a, b) => {
          const valA = a[column] || '';
          const valB = b[column] || '';

          if (column === 'registrationDate') {
              const dateA = a.registrationDate ? a.registrationDate.toDate() : new Date(0);
              const dateB = b.registrationDate ? b.registrationDate.toDate() : new Date(0);
              return direction === 'asc' ? dateA - dateB : dateB - dateA;
          } else if (column.includes('.')) { // Pre vnorené polia ako billing.clubName
              const parts = column.split('.');
              let nestedValA = a;
              let nestedValB = b;
              for (const part of parts) {
                  nestedValA = nestedValA ? nestedValA[part] : undefined;
                  nestedValB = nestedValB ? nestedValB[part] : undefined;
              }
              const finalValA = nestedValA || '';
              const finalValB = nestedValB || '';
              return direction === 'asc' ? String(finalValA).localeCompare(String(finalValB)) : String(finalValB).localeCompare(String(finalValA));
          }
          else if (typeof valA === 'string' && typeof valB === 'string') {
              return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          } else {
              return direction === 'asc' ? valA - valB : valB - valA;
          }
      });
      setFilteredUsers(sorted);
  };

  // Filtering logic
  const openFilterModal = (column) => {
      console.log("AllRegistrationsApp: openFilterModal volaná pre stĺpec:", column); // NOVÝ LOG
      console.log("AllRegistrationsApp: Aktuálny stav allUsers:", allUsers); // NOVÝ DIAGNOSTICKÝ LOG

      setFilterColumn(column);
      // Získanie unikátnych hodnôt pre daný stĺpec, prevedené na string a malé písmená pre konzistentnosť
      const values = [...new Set(allUsers.map(u => {
          let val = u[column];
          if (column === 'registrationDate' && val && typeof val.toDate === 'function') {
              // Používame toLocaleString pre zobrazenie dátumu a času vo filtri
              val = val.toDate().toLocaleString('sk-SK');
          } else if (column.includes('.')) { // Pre vnorené polia ako billing.clubName
              const parts = column.split('.');
              let nestedVal = u;
              for (const part of parts) {
                  nestedVal = nestedVal ? nestedVal[part] : undefined;
              }
              val = nestedVal;
          }
          // Špecifické pre boolean stĺpce (napr. 'approved')
          if (typeof val === 'boolean') {
              return val ? 'áno' : 'nie';
          }
          return String(val || '').toLowerCase(); // Všetko na malé písmená
      }))].filter(v => v !== '').sort(); // Odstrániť prázdne a zoradiť
      setUniqueColumnValues(values);
      setFilterModalOpen(true);
  };

  const closeFilterModal = () => {
      setFilterModalOpen(false);
      setFilterColumn('');
      setUniqueColumnValues([]);
  };

  const applyFilter = (column, values) => {
      // Uloženie vybraných hodnôt filtra (už sú v malých písmenách)
      setActiveFilters(prev => ({ ...prev, [column]: values }));
  };

  const clearFilter = (column) => {
      setActiveFilters(prev => {
          const newFilters = { ...prev };
          delete newFilters[column];
          return newFilters;
      });
  };

  // Effect to re-apply filters when activeFilters or allUsers change
  React.useEffect(() => {
      let currentFiltered = [...allUsers];

      Object.keys(activeFilters).forEach(column => {
          const filterValues = activeFilters[column];
          if (filterValues.length > 0) {
              currentFiltered = currentFiltered.filter(user => {
                  let userValue;
                  if (column === 'registrationDate' && user.registrationDate && typeof user.registrationDate.toDate === 'function') {
                      // Používame toLocaleString aj pre porovnanie vo filtri
                      userValue = user.registrationDate.toDate().toLocaleString('sk-SK').toLowerCase();
                  } else if (column.includes('.')) {
                      const parts = column.split('.');
                      let nestedVal = user;
                      for (const part of parts) {
                          nestedVal = nestedVal ? nestedVal[part] : undefined;
                      }
                      userValue = String(nestedVal || '').toLowerCase();
                  } else {
                      userValue = String(user[column] || '').toLowerCase();
                  }
                  // Špecifické pre boolean stĺpce (napr. 'approved')
                  if (typeof user[column] === 'boolean') {
                      userValue = user[column] ? 'áno' : 'nie';
                  }
                  return filterValues.includes(userValue);
              });
          }
      });
      setFilteredUsers(currentFiltered);
  }, [allUsers, activeFilters]);


  // useEffect for updating header link visibility
  React.useEffect(() => {
    console.log(`AllRegistrationsApp: useEffect pre aktualizáciu odkazov hlavičky. User: ${user ? user.uid : 'null'}`); // Zmena logu
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink) {
      if (user) { // If user is logged in
        authLink.classList.add('hidden');
        profileLink && profileLink.classList.remove('hidden');
        logoutButton && logoutButton.classList.remove('hidden');
        registerLink && registerLink.classList.add('hidden');
        console.log("AllRegistrationsApp: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie."); // Zmena logu
      } else { // If user is not logged in
        authLink.classList.remove('hidden');
        profileLink && profileLink.classList.add('hidden');
        logoutButton && logoutButton.classList.add('hidden');
        // Register link visibility will now be handled by register.js based on registration settings
        // For logged-in-all-registrations.html, if not logged in, register link should be visible by default
        registerLink && registerLink.classList.remove('hidden'); 
        console.log("AllRegistrationsApp: Používateľ odhlásený. Zobrazené: Prihlásenie, Registrácia. Skryté: Moja zóna, Odhlásenie."); // Zmena logu
      }
    }
  }, [user]);

  // Handle logout (needed for the header logout button)
  const handleLogout = React.useCallback(async () => {
    if (!auth) return;
    try {
      setLoading(true);
      await auth.signOut();
      setUserNotificationMessage("Úspešne odhlásený.");
      window.location.href = 'login.html';
    } catch (e) {
      console.error("AllRegistrationsApp: Chyba pri odhlásení:", e); // Zmena logu
      setError(`Chyba pri odhlásení: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  // Attach logout handler to the button in the header
  React.useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
    return () => {
      if (logoutButton) {
        logoutButton.removeEventListener('click', handleLogout);
      }
    };
  }, [handleLogout]);

  // Display loading state
  if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
    if (isAuthReady && user === null) {
        console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html"); // Zmena logu
        window.location.href = 'login.html';
        return null;
    }
    let loadingMessage = 'Načítavam...';
    if (isAuthReady && user && !userProfileData) {
        loadingMessage = 'Načítavam...'; // Špecifická správa pre profilové dáta
    } else if (loading) { // Všeobecný stav načítavania, napr. pri odosielaní formulára
        loadingMessage = 'Načítavam...';
    }

    return React.createElement(
      'div',
      { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
      React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
    );
  }

  // Ak používateľ nie je admin alebo nie je schválený, zobrazíme mu chybu
  if (userProfileData.role !== 'admin' || userProfileData.approved === false) {
      return React.createElement(
          'div',
          { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
          React.createElement(NotificationModal, {
              message: userNotificationMessage,
              onClose: () => setUserNotificationMessage(''),
              displayNotificationsEnabled: userProfileData?.displayNotifications
          }),
          React.createElement(
              'div',
              { className: 'w-full max-w-4xl mt-20 mb-10 p-4' },
              React.createElement(
                  'div',
                  { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4', role: 'alert' },
                  error || "Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup."
              )
          )
      );
  }

  // Ak je používateľ admin a schválený, zobrazíme mu tabuľku registrácií
  return React.createElement(
    'div',
    { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
    React.createElement(NotificationModal, {
        message: userNotificationMessage,
        onClose: () => setUserNotificationMessage(''),
        displayNotificationsEnabled: userProfileData?.displayNotifications
    }),
    React.createElement(
      'div',
      { className: 'w-full max-w-7xl mt-20 mb-10 p-4' },
      error && React.createElement(
        'div',
        { className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 whitespace-pre-wrap', role: 'alert' },
        error
      ),
      React.createElement(
        'div',
        { className: 'bg-white p-8 rounded-lg shadow-xl w-full' },
        React.createElement('h1', { className: 'text-3xl font-bold text-center text-gray-800 mb-6' },
          'Všetky registrácie'
        ),
        // Tabuľka všetkých registrácií
        React.createElement(
            'div',
            { className: 'overflow-x-auto relative shadow-md sm:rounded-lg' },
            React.createElement(
                'table',
                { className: 'w-full text-sm text-left text-gray-500' },
                React.createElement(
                    'thead',
                    { className: 'text-xs text-gray-700 uppercase bg-gray-50' },
                    React.createElement(
                        'tr',
                        null,
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('role') },
                                'Rola',
                                currentSort.column === 'role' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('role'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('approved') },
                                'Schválený',
                                currentSort.column === 'approved' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('approved'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('registrationDate') },
                                'Dátum registrácie',
                                currentSort.column === 'registrationDate' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('registrationDate'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('firstName') },
                                'Meno',
                                currentSort.column === 'firstName' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('firstName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('lastName') },
                                'Priezvisko',
                                currentSort.column === 'lastName' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('lastName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('email') },
                                'Email',
                                currentSort.column === 'email' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('email'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('contactPhoneNumber') },
                                'Tel. číslo',
                                currentSort.column === 'contactPhoneNumber' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('contactPhoneNumber'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('billing.clubName') },
                                'Názov klubu',
                                currentSort.column === 'billing.clubName' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.clubName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('billing.ico') },
                                'IČO',
                                currentSort.column === 'billing.ico' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.ico'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('billing.dic') },
                                'DIČ',
                                currentSort.column === 'billing.dic' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.dic'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('billing.icDph') },
                                'IČ DPH',
                                currentSort.column === 'billing.icDph' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.icDph'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('street') },
                                'Ulica',
                                currentSort.column === 'street' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('street'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('houseNumber') },
                                'Číslo domu',
                                currentSort.column === 'houseNumber' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('houseNumber'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('city') },
                                'Mesto',
                                currentSort.column === 'city' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('city'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('postalCode') },
                                'PSČ',
                                currentSort.column === 'postalCode' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('postalCode'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        ),
                        React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer' },
                            React.createElement('div', { className: 'flex items-center whitespace-nowrap', onClick: () => handleSort('country') },
                                'Krajina',
                                currentSort.column === 'country' && React.createElement('span', { className: 'ml-1' }, currentSort.direction === 'asc' ? '▲' : '▼'),
                                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('country'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                            )
                        )
                    )
                ),
                React.createElement(
                    'tbody',
                    null,
                    filteredUsers.length === 0 ? (
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('td', { colSpan: '16', className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                        )
                    ) : (
                        filteredUsers.map(u => (
                            React.createElement(
                                'tr',
                                { key: u.id, className: 'bg-white border-b hover:bg-gray-50' },
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.role || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.approved ? 'Áno' : 'Nie'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.registrationDate ? u.registrationDate.toDate().toLocaleString('sk-SK') : '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.firstName || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.lastName || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.contactPhoneNumber || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.billing?.clubName || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.billing?.ico || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.billing?.dic || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.billing?.icDph || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.street || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.houseNumber || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.city || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.postalCode || '-'),
                                React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.country || '-')
                            )
                        ))
                    )
                )
            )
        ),
        React.createElement(FilterModal, {
            isOpen: filterModalOpen,
            onClose: closeFilterModal,
            columnName: filterColumn,
            onApplyFilter: applyFilter,
            initialFilterValues: activeFilters[filterColumn] || [],
            onClearFilter: clearFilter,
            uniqueColumnValues: uniqueColumnValues
        })
      )
    )
  );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
