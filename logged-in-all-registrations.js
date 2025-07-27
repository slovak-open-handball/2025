// logged-in-all-registrations.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-all-registrations.html a že header.js
// už inicializoval Firebase a spravuje autentifikáciu a odkazy hlavičky.

// NotificationModal Component (pre konzistentné notifikácie)
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
        // Logovanie pre debugovanie
        console.log("NotificationModal useEffect: message=", message, "displayNotificationsEnabled=", displayNotificationsEnabled);

        // Zobrazí notifikáciu len ak je správa A notifikácie sú povolené
        if (message && displayNotificationsEnabled) {
            console.log("NotificationModal: Zobrazujem notifikáciu.");
            setShow(true);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                console.log("NotificationModal: Skrývam notifikáciu po časovom limite.");
                setShow(false);
                setTimeout(onClose, 500);
            }, 10000); // Notifikácia zmizne po 10 sekundách
        } else {
            console.log("NotificationModal: Skrývam notifikáciu alebo nezobrazujem (správa:", message, ", stav show:", show, ", notifikácie povolené:", displayNotificationsEnabled, ").");
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
function AllRegistrationsApp() {
    // Firebase instancie budú získané z globálnej firebase aplikácie inicializovanej v HTML/header.js
    const [auth, setAuth] = React.useState(null);
    const [db, setDb] = React.useState(null);
    const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
    const [userProfileData, setUserProfileData] = React.useState(null); // Dáta prihláseného používateľa
    const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [userNotificationMessage, setUserNotificationMessage] = React.useState(''); // Stav pre notifikácie
    const [allUsers, setAllUsers] = React.useState([]); // Všetci používatelia z Firestore
    const [filteredUsers, setFilteredUsers] = React.useState([]); // Filtrovaní používatelia
    const [currentSort, setCurrentSort] = React.useState({ column: 'registeredAt', direction: 'desc' });
    const [filterModalOpen, setFilterModalOpen] = React.useState(false);
    const [filterColumn, setFilterColumn] = React.useState('');
    const [activeFilters, setActiveFilters] = React.useState({}); // { columnName: [value1, value2] }
    const [uniqueColumnValues, setUniqueColumnValues] = React.useState([]);

    // Effect for Firebase instance setup (runs only once)
    React.useEffect(() => {
        try {
            if (typeof firebase === 'undefined') {
                console.error("AllRegistrationsApp: Firebase SDK nie je načítané.");
                setError("Firebase SDK nie je načítané. Skontrolujte logged-in-all-registrations.html.");
                setLoading(false);
                return;
            }

            // Získanie už inicializovaných inštancií Firebase
            const firebaseAppInstance = firebase.app();
            setAuth(firebase.auth(firebaseAppInstance));
            setDb(firebase.firestore(firebaseAppInstance));
            console.log("AllRegistrationsApp: Firebase Auth a Firestore inštancie získané z globálnej aplikácie.");

            // Nastavenie listenera pre autentifikáciu
            const unsubscribeAuth = firebase.auth(firebaseAppInstance).onAuthStateChanged(async (currentUser) => {
                console.log("AllRegistrationsApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
                setUser(currentUser); // Nastaví Firebase User objekt
                setIsAuthReady(true); // Mark auth as ready after the first check
            });

            return () => {
                if (unsubscribeAuth) {
                    unsubscribeAuth();
                }
            };
        } catch (e) {
            console.error("AllRegistrationsApp: Nepodarilo sa získať Firebase inštancie alebo nastaviť Auth listener:", e);
            setError(`Chyba pri inicializácii Firebase: ${e.message}`);
            setLoading(false);
        }
    }, []); // Prázdne pole závislostí zabezpečí, že sa spustí len raz

    // Načítanie používateľských dát z Firestore po inicializácii Auth a DB
    React.useEffect(() => {
        let unsubscribeUserDoc;
        // appId by mal byť globálne dostupný z HTML
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        if (isAuthReady && db && auth && user !== undefined) { // Pridaná závislosť na 'auth'
            if (user === null) {
                console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
                window.location.href = 'login.html';
                return;
            }

            if (user) {
                console.log(`AllRegistrationsApp: Pokúšam sa načítať používateľský dokument pre UID: ${user.uid}`);
                setLoading(true);

                try {
                    const userDocRef = db.collection('users').doc(user.uid);
                    unsubscribeUserDoc = userDocRef.onSnapshot(docSnapshot => {
                        console.log("AllRegistrationsApp: onSnapshot pre používateľský dokument spustený.");
                        if (docSnapshot.exists) {
                            const userData = docSnapshot.data();
                            console.log("AllRegistrationsApp: Používateľský dokument existuje, dáta:", userData);

                            // Táto logika je už v header.js, ale pre istotu ju tu ponechávam pre prípad,
                            // že by sa stránka načítala priamo bez plnej inicializácie header.js
                            // alebo pre prípad, že by sa zmenila rola/approved status počas session.
                            if (!userData.passwordLastChanged || typeof userData.passwordLastChanged.toDate !== 'function') {
                                console.error("AllRegistrationsApp: passwordLastChanged NIE JE platný Timestamp objekt! Typ:", typeof userData.passwordLastChanged, "Hodnota:", userData.passwordLastChanged);
                                console.log("AllRegistrationsApp: Okamžite odhlasujem používateľa kvôli neplatnému timestampu zmeny hesla.");
                                auth.signOut();
                                window.location.href = 'login.html';
                                localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                                return;
                            }

                            const firestorePasswordChangedTime = userData.passwordLastChanged.toDate().getTime();
                            const localStorageKey = `passwordLastChanged_${user.uid}`;
                            let storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

                            console.log(`AllRegistrationsApp: Firestore passwordLastChanged (konvertované): ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

                            if (storedPasswordChangedTime === 0 && firestorePasswordChangedTime !== 0) {
                                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                                console.log("AllRegistrationsApp: Inicializujem passwordLastChanged v localStorage (prvé načítanie).");
                            } else if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                                console.log("AllRegistrationsApp: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                                auth.signOut();
                                window.location.href = 'login.html';
                                localStorage.removeItem(localStorageKey);
                                return;
                            } else if (firestorePasswordChangedTime < storedPasswordChangedTime) {
                                console.warn("AllRegistrationsApp: Detekovaný starší timestamp z Firestore ako uložený. Odhlasujem používateľa (potenciálny nesúlad).");
                                auth.signOut();
                                window.location.href = 'login.html';
                                localStorage.removeItem(localStorageKey);
                                return;
                            } else {
                                localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                                console.log("AllRegistrationsApp: Timestampy sú rovnaké, aktualizujem localStorage.");
                            }

                            setUserProfileData(userData); // Uloženie celých dát profilu
                            setLoading(false);
                            setError('');

                            // Aktualizácia viditeľnosti menu po načítaní roly (volanie globálnej funkcie z left-menu.js)
                            if (typeof window.updateMenuItemsVisibility === 'function') {
                                window.updateMenuItemsVisibility(userData.role);
                            } else {
                                console.warn("AllRegistrationsApp: Funkcia updateMenuItemsVisibility nie je definovaná.");
                            }

                            console.log("AllRegistrationsApp: Načítanie používateľských dát dokončené, loading: false");
                        } else {
                            console.warn("AllRegistrationsApp: Používateľský dokument sa nenašiel pre UID:", user.uid);
                            setError("Chyba: Používateľský profil sa nenašiel alebo nemáte dostatočné oprávnenia. Skúste sa prosím znova prihlásiť.");
                            setLoading(false);
                        }
                    }, error => {
                        console.error("AllRegistrationsApp: Chyba pri načítaní používateľských dát z Firestore (onSnapshot error):", error);
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
                        setLoading(false);
                    });
                } catch (e) {
                    console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre používateľské dáta (try-catch):", e);
                    setError(`Chyba pri nastavovaní poslucháča pre používateľské dáta: ${e.message}`);
                    setLoading(false);
                }
            }
        } else if (isAuthReady && user === undefined) {
            console.log("AllRegistrationsApp: Auth ready, user undefined. Nastavujem loading na false.");
            setLoading(false);
        }

        return () => {
            if (unsubscribeUserDoc) {
                console.log("AllRegistrationsApp: Ruším odber onSnapshot pre používateľský dokument.");
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
                }, error => {
                    console.error("AllRegistrationsApp: Chyba pri načítaní všetkých používateľov z Firestore:", error);
                    setError(`Chyba pri načítaní používateľov: ${error.message}`);
                    setLoading(false);
                });
            } catch (e) {
                console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre všetkých používateľov:", e);
                setError(`Chyba pri načítaní používateľov: ${e.message}`);
                setLoading(false);
            }
        } else if (isAuthReady && userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved === false)) {
            setError("Nemáte oprávnenie na zobrazenie tejto stránky. Iba schválení administrátori majú prístup.");
            setLoading(false);
            console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor. Prístup zamietnutý.");
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

            if (column === 'registeredAt') {
                const dateA = a.registeredAt ? a.registeredAt.toDate() : new Date(0);
                const dateB = b.registeredAt ? b.registeredAt.toDate() : new Date(0);
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
        setFilterColumn(column);
        // Získanie unikátnych hodnôt pre daný stĺpec, prevedené na string a malé písmená pre konzistentnosť
        const values = [...new Set(allUsers.map(u => {
            let val = u[column];
            if (column === 'registeredAt' && val && typeof val.toDate === 'function') {
                val = val.toDate().toLocaleDateString('sk-SK'); // Formát dátumu pre zobrazenie
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
                    if (column === 'registeredAt' && user.registeredAt && typeof user.registeredAt.toDate === 'function') {
                        userValue = user.registeredAt.toDate().toLocaleDateString('sk-SK').toLowerCase();
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


    // Display loading state
    if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
        if (isAuthReady && user === null) {
            console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
            window.location.href = 'login.html';
            return null;
        }
        let loadingMessage = 'Načítavam...';
        if (isAuthReady && user && !userProfileData) {
            loadingMessage = 'Načítavam používateľský profil...'; // Špecifická správa pre profilové dáta
        } else if (loading) {
            loadingMessage = 'Načítavam všetky registrácie...';
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

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
        React.createElement(NotificationModal, {
            message: userNotificationMessage,
            onClose: () => setUserNotificationMessage(''),
            displayNotificationsEnabled: userProfileData?.displayNotifications // ODovzdanie propu!
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
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('registeredAt') },
                                    'Dátum registrácie',
                                    currentSort.column === 'registeredAt' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('registeredAt'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('firstName') },
                                    'Meno',
                                    currentSort.column === 'firstName' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('firstName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('lastName') },
                                    'Priezvisko',
                                    currentSort.column === 'lastName' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('lastName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('email') },
                                    'Email',
                                    currentSort.column === 'email' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('email'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('contactPhoneNumber') },
                                    'Tel. číslo',
                                    currentSort.column === 'contactPhoneNumber' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('contactPhoneNumber'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('role') },
                                    'Rola',
                                    currentSort.column === 'role' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('role'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('approved') },
                                    'Schválený',
                                    currentSort.column === 'approved' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('approved'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('passwordLastChanged') },
                                    'Posledná zmena hesla',
                                    currentSort.column === 'passwordLastChanged' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('passwordLastChanged'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('billing.clubName') },
                                    'Názov klubu',
                                    currentSort.column === 'billing.clubName' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.clubName'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('billing.ico') },
                                    'IČO',
                                    currentSort.column === 'billing.ico' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.ico'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('billing.dic') },
                                    'DIČ',
                                    currentSort.column === 'billing.dic' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.dic'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('billing.icDph') },
                                    'IČ DPH',
                                    currentSort.column === 'billing.icDph' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('billing.icDph'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('street') },
                                    'Ulica',
                                    currentSort.column === 'street' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('street'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('houseNumber') },
                                    'Číslo domu',
                                    currentSort.column === 'houseNumber' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('houseNumber'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('city') },
                                    'Mesto',
                                    currentSort.column === 'city' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('city'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('postalCode') },
                                    'PSČ',
                                    currentSort.column === 'postalCode' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('postalCode'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
                                ),
                                React.createElement('th', { scope: 'col', className: 'py-3 px-6 cursor-pointer', onClick: () => handleSort('country') },
                                    'Krajina',
                                    currentSort.column === 'country' && (currentSort.direction === 'asc' ? ' ▲' : ' ▼'),
                                    React.createElement('button', { onClick: (e) => { e.stopPropagation(); openFilterModal('country'); }, className: 'ml-2 text-gray-400 hover:text-gray-600' }, '⚙️')
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
                                    React.createElement('td', { colSpan: '17', className: 'py-4 px-6 text-center text-gray-500' }, 'Žiadne registrácie na zobrazenie.')
                                )
                            ) : (
                                filteredUsers.map(u => (
                                    React.createElement(
                                        'tr',
                                        { key: u.id, className: 'bg-white border-b hover:bg-gray-50' },
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.registeredAt ? u.registeredAt.toDate().toLocaleDateString('sk-SK') : '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.firstName || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.lastName || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.contactPhoneNumber || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.role || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.approved ? 'Áno' : 'Nie'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.passwordLastChanged ? u.passwordLastChanged.toDate().toLocaleString('sk-SK') : '-'),
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
