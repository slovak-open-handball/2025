// logged-in-all-registrations.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-all-registrations.html.

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
        onApplyFilter(columnName, selectedValues); // Odovzdať pole vybraných hodnôt (už sú malé písmená)
        onClose();
    };

    const handleClear = () => {
        onClearFilter(columnName);
        setSelectedValues([]); // Vymaže všetky vybrané hodnoty
        onClose();
    };

    return React.createElement(
        'div',
        {
            className: 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50'
        },
        React.createElement(
            'div',
            {
                className: 'bg-white p-6 rounded-lg shadow-xl w-96 max-w-full'
            },
            React.createElement(
                'h2',
                { className: 'text-xl font-bold mb-4' },
                `Filtrovať stĺpec: ${columnName}`
            ),
            React.createElement(
                'div',
                { className: 'max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2 mb-4' },
                uniqueColumnValues.length > 0 ? (
                    uniqueColumnValues.map(value =>
                        React.createElement(
                            'label',
                            { key: value, className: 'flex items-center space-x-2 py-1 cursor-pointer hover:bg-gray-100 rounded-md px-2' },
                            React.createElement('input', {
                                type: 'checkbox',
                                className: 'form-checkbox h-4 w-4 text-blue-600 rounded-sm focus:ring-blue-500',
                                value: value,
                                // KĽÚČOVÁ ZMENA: Porovnávanie hodnoty checkboxu s malými písmenami v selectedValues
                                checked: selectedValues.includes(String(value).toLowerCase()),
                                onChange: () => handleCheckboxChange(value)
                            }),
                            React.createElement('span', { className: 'text-gray-700' }, value === '' ? '(Prázdna hodnota)' : value) // Zobrazenie pre prázdne hodnoty
                        )
                    )
                ) : (
                    React.createElement('p', { className: 'text-gray-500 text-center' }, 'Žiadne unikátne hodnoty na filtrovanie.')
                )
            ),
            React.createElement(
                'div',
                { className: 'flex justify-end space-x-2' },
                React.createElement(
                    'button',
                    {
                        className: 'px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200',
                        onClick: onClose
                    },
                    'Zrušiť'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200',
                        onClick: handleClear
                    },
                    'Vymazať filter'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200',
                        onClick: handleApply
                    },
                    'Použiť filter'
                )
            )
        )
    );
}


// Hlavný React komponent pre stránku všetkých registrácií
function AllRegistrationsApp() {
    const [app, setApp] = React.useState(null);
    const [auth, setAuth] = React.useState(null);
    const [db, setDb] = React.useState(null);
    const [user, setUser] = React.useState(undefined); // Firebase User object from onAuthStateChanged
    const [userProfileData, setUserProfileData] = React.useState(null); // Firestore user data
    const [isAuthReady, setIsAuthReady] = React.useState(false); // Flag pre pripravenosť autentifikácie
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    const [allUsers, setAllUsers] = React.useState([]); // Stav pre všetkých používateľov z databázy
    const [isFilterModalOpen, setIsFilterModal] = React.useState(false);
    const [currentFilterColumn, setCurrentFilterColumn] = React.useState('');
    const [uniqueValuesForModal, setUniqueValuesForModal] = React.useState([]); // Nový stav pre unikátne hodnoty pre modal
    const [appliedFilters, setAppliedFilters] = React.useState({}); // { 'email': ['john'], 'role': ['admin', 'user'] }

    // Mapovanie zobrazovaných názvov stĺpcov na kľúče dát
    const columnDataMap = {
        'Rola': 'role',
        'Schválený': 'approved',
        'Dátum registrácie': 'registrationDate',
        'Meno': 'firstName',
        'Priezvisko': 'lastName',
        'E-mail': 'email',
        'Telefón': 'contactPhoneNumber',
        'Názov klubu': 'billing.clubName',
        'IČO': 'billing.ico',
        'DIČ': 'billing.dic',
        'IČ DPH': 'billing.icDph',
        'Ulica': 'street',
        'Popisné číslo': 'houseNumber',
        'Mesto': 'city',
        'PSČ': 'postalCode',
        'Krajina': 'country'
    };

    // Používame globálne definované appId
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Effect pre inicializáciu Firebase a nastavenie Auth Listenera (spustí sa len raz)
    React.useEffect(() => {
        let unsubscribeAuth;
        let firestoreInstance;

        try {
            if (typeof firebase === 'undefined') {
                console.error("AllRegistrationsApp: Firebase SDK nie je načítané.");
                setError("Firebase SDK nie je načítané. Skontrolujte logged-in-all-registrations.html.");
                setLoading(false);
                return;
            }

            let firebaseAppInstance;
            if (firebase.apps.length === 0) {
                firebaseAppInstance = firebase.initializeApp(JSON.parse(__firebase_config));
            } else {
                firebaseAppInstance = firebase.app();
            }
            setApp(firebaseAppInstance);

            const authInstance = firebase.auth(firebaseAppInstance);
            setAuth(authInstance);
            firestoreInstance = firebase.firestore(firebaseAppInstance);
            setDb(firestoreInstance);

            const signIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await authInstance.signInWithCustomToken(__initial_auth_token);
                    }
                } catch (e) {
                    console.error("AllRegistrationsApp: Chyba pri počiatočnom prihlásení Firebase:", e);
                    setError(`Chyba pri prihlásení: ${e.message}`);
                }
            };

            unsubscribeAuth = authInstance.onAuthStateChanged(async (currentUser) => {
                console.log("AllRegistrationsApp: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
                setUser(currentUser);
                setIsAuthReady(true);
            });

            signIn();

            return () => {
                if (unsubscribeAuth) {
                    unsubscribeAuth();
                }
            };
        } catch (e) {
            console.error("AllRegistrationsApp: Nepodarilo sa inicializovať Firebase:", e);
            setError(`Chyba pri inicializácii Firebase: ${e.message}`);
            setLoading(false);
        }
    }, []);

    // Effect pre načítanie používateľských dát z Firestore a kontrolu oprávnení
    React.useEffect(() => {
        let unsubscribeUserDoc;

        if (isAuthReady && db && user !== undefined) {
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

                            // --- Kontrola passwordLastChanged pre platnosť relácie ---
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
                            // --- KONIEC LOGIKY KONTROLY HESLA ---

                            setUserProfileData(userData);
                            setLoading(false);
                            setError('');

                            // Aktualizácia viditeľnosti položiek ľavého menu na základe roly
                            if (typeof window.updateMenuItemsVisibility === 'function') {
                                window.updateMenuItemsVisibility(userData.role);
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
                        console.log("AllRegistrationsApp: Načítanie používateľských dát zlyhalo, loading: false");
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

    // Effect pre načítanie VŠETKÝCH používateľov (spustí sa po overení admin roly)
    React.useEffect(() => {
        let unsubscribeAllUsers;

        if (db && userProfileData && userProfileData.role === 'admin' && userProfileData.approved === true) {
            console.log("AllRegistrationsApp: Prihlásený používateľ je schválený administrátor. Načítavam všetkých používateľov.");
            setLoading(true);
            try {
                unsubscribeAllUsers = db.collection('users').onSnapshot(snapshot => {
                    const fetchedUsers = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        // Konvertovanie Timestamp objektov na čitateľné reťazce
                        if (data.registrationDate && typeof data.registrationDate.toDate === 'function') {
                            data.registrationDate = data.registrationDate.toDate().toLocaleString('sk-SK');
                        }
                        if (data.passwordLastChanged && typeof data.passwordLastChanged.toDate === 'function') {
                            data.passwordLastChanged = data.passwordLastChanged.toDate().toLocaleString('sk-SK');
                        }
                        fetchedUsers.push({ id: doc.id, ...data });
                    });
                    setAllUsers(fetchedUsers);
                    setLoading(false);
                    setError('');
                    console.log("AllRegistrationsApp: Všetci používatelia aktualizovaní z onSnapshot.");
                }, error => {
                    console.error("AllRegistrationsApp: Chyba pri načítaní všetkých používateľov z Firestore (onSnapshot error):", error);
                    setError(`Chyba pri načítaní používateľov: ${error.message}`);
                    setLoading(false);
                });
            } catch (e) {
                console.error("AllRegistrationsApp: Chyba pri nastavovaní onSnapshot pre všetkých používateľov (try-catch):", e);
                setError(`Chyba pri nastavovaní poslucháča pre používateľov: ${e.message}`);
                setLoading(false);
            }
        } else {
            setAllUsers([]); // Vyčisti zoznam používateľov, ak nie je admin
        }

        return () => {
            if (unsubscribeAllUsers) {
                console.log("AllRegistrationsApp: Ruším odber onSnapshot pre všetkých používateľov.");
                unsubscribeAllUsers();
            }
        };
    }, [db, userProfileData]);

    // Handle logout (potrebné pre tlačidlo odhlásenia v hlavičke)
    const handleLogout = React.useCallback(async () => {
        if (!auth) return;
        try {
            setLoading(true);
            await auth.signOut();
            console.log("AllRegistrationsApp: Odhlásenie úspešné. Presmerovávam.");
            window.location.href = 'login.html';
        } catch (e) {
            console.error("AllRegistrationsApp: Chyba pri odhlásení:", e);
            setError(`Chyba pri odhlásení: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [auth]);

    // Pripojenie logout handleru k tlačidlu v hlavičke
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

    // Funkcia na rekurzívne získanie hodnoty z objektu podľa cesty (napr. 'billing.clubName')
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    // Funkcia na získanie unikátnych hodnôt pre daný stĺpec
    const getUniqueValuesForColumn = (columnDisplayName) => {
        const dataKey = columnDataMap[columnDisplayName];
        if (!dataKey) return [];

        const values = allUsers.map(user => {
            let value = getNestedValue(user, dataKey);
            // Špeciálne ošetrenie pre boolean 'approved' stĺpec
            if (dataKey === 'approved') {
                return value ? 'Áno' : 'Nie';
            }
            // Konvertovať na reťazec a orezávať pre konzistentnosť
            return (value === null || value === undefined) ? '' : String(value).trim();
        });

        // Filtrovať duplikáty a zoradiť
        const unique = [...new Set(values)].sort((a, b) => {
            // Prázdne hodnoty vždy na konci
            if (a === '') return 1;
            if (b === '') return -1;
            return a.localeCompare(b, 'sk', { sensitivity: 'base' });
        });
        return unique;
    };


    // Funkcie pre správu filtrovacieho modálneho okna
    const openFilterModal = (columnDisplayName) => {
        setCurrentFilterColumn(columnDisplayName);
        // Získame unikátne hodnoty pre tento stĺpec a nastavíme ich pre modal
        setUniqueValuesForModal(getUniqueValuesForColumn(columnDisplayName));
        setIsFilterModal(true);
    };

    const closeFilterModal = () => {
        setIsFilterModal(false);
        setCurrentFilterColumn('');
        setUniqueValuesForModal([]); // Vyčistiť unikátne hodnoty pri zatvorení
    };

    // handleApplyFilter teraz prijíma pole hodnôt
    const handleApplyFilter = (columnDisplayName, selectedValues) => {
        const dataKey = columnDataMap[columnDisplayName];
        if (dataKey) {
            // Ukladáme pole vybraných hodnôt, už sú malé písmená z FilterModal
            setAppliedFilters(prevFilters => ({
                ...prevFilters,
                [dataKey]: selectedValues.map(val => String(val).toLowerCase()) // Ukladáme malými písmenami pre case-insensitive porovnanie
            }));
        }
    };

    const handleClearFilter = (columnDisplayName) => {
        const dataKey = columnDataMap[columnDisplayName];
        if (dataKey) {
            setAppliedFilters(prevFilters => {
                const newFilters = { ...prevFilters };
                delete newFilters[dataKey];
                return newFilters;
            });
        }
    };

    // Filtrovanie používateľov na základe aplikovaných filtrov
    const filteredUsers = React.useMemo(() => {
        if (Object.keys(appliedFilters).length === 0) {
            return allUsers;
        }

        return allUsers.filter(user => {
            return Object.entries(appliedFilters).every(([filterKey, filterValuesArray]) => {
                // Ak pre daný filter nie sú vybrané žiadne hodnoty, tento filter neaplikujeme
                if (filterValuesArray.length === 0) {
                    return true;
                }

                let userValue;
                // Špeciálne ošetrenie pre boolean 'approved' stĺpec
                if (filterKey === 'approved') {
                    userValue = user.approved ? 'áno' : 'nie'; // Konvertujeme na string pre porovnanie
                } else {
                    // Pre ostatné polia
                    userValue = getNestedValue(user, filterKey);
                    userValue = (userValue === null || userValue === undefined) ? '' : String(userValue);
                }
                
                // Používame === pre presnú zhodu namiesto includes
                return filterValuesArray.some(filterVal => 
                    userValue.toLowerCase() === filterVal // filterVal je už malými písmenami
                );
            });
        });
    }, [allUsers, appliedFilters]);


    // Zobrazenie stavu načítavania
    if (!isAuthReady || user === undefined || (user && !userProfileData) || loading) {
        if (isAuthReady && user === null) {
            console.log("AllRegistrationsApp: Auth je ready a používateľ je null, presmerovávam na login.html");
            window.location.href = 'login.html';
            return null;
        }
        let loadingMessage = 'Načítavam...';
        if (isAuthReady && user && !userProfileData) {
            loadingMessage = 'Načítavam používateľský profil...';
        } else if (loading) {
            loadingMessage = 'Načítavam údaje používateľov...';
        }

        return React.createElement(
            'div',
            { className: 'flex items-center justify-center min-h-screen bg-gray-100' },
            React.createElement('div', { className: 'text-xl font-semibold text-gray-700' }, loadingMessage)
        );
    }

    // Ak používateľ nie je admin, presmeruj ho
    if (userProfileData && (userProfileData.role !== 'admin' || userProfileData.approved !== true)) {
        console.log("AllRegistrationsApp: Používateľ nie je schválený administrátor a snaží sa pristupovať k všetkým registráciám, presmerovávam.");
        window.location.href = 'login.html'; // Presmerovanie na login.html, ak nemá prístup
        return null;
    }

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
        React.createElement(FilterModal, {
            isOpen: isFilterModalOpen,
            onClose: closeFilterModal,
            columnName: currentFilterColumn,
            onApplyFilter: handleApplyFilter,
            // initialFilterValues je teraz pole, ak existuje, inak prázdne pole
            initialFilterValues: appliedFilters[columnDataMap[currentFilterColumn]] || [], 
            onClearFilter: handleClearFilter,
            uniqueColumnValues: uniqueValuesForModal // Odovzdávame unikátne hodnoty pre zoznam checkboxov
        }),
        React.createElement(
            'div',
            { className: 'w-full max-w-full px-4 mt-8 mb-10' },
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
                filteredUsers.length === 0 && !loading ? (
                    React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadne registrácie na zobrazenie.')
                ) : (
                    React.createElement(
                        'div',
                        { className: 'overflow-x-auto' },
                        React.createElement(
                            'table',
                            { className: 'min-w-full bg-white rounded-lg shadow-md' },
                            React.createElement(
                                'thead',
                                null,
                                React.createElement(
                                    'tr',
                                    { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                                    // Hlavičky stĺpcov s onClick udalosťou
                                    Object.entries(columnDataMap).map(([displayName, dataKey]) => {
                                        const isActive = appliedFilters[dataKey] && appliedFilters[dataKey].length > 0;
                                        const filteredValues = isActive ? appliedFilters[dataKey].join(', ') : '';

                                        return React.createElement(
                                            'th',
                                            {
                                                key: dataKey,
                                                className: 'py-3 px-6 text-left whitespace-nowrap cursor-pointer hover:bg-gray-300 transition-colors duration-150',
                                                onClick: () => openFilterModal(displayName)
                                            },
                                            React.createElement('div', { className: 'flex items-center' },
                                                React.createElement('span', null, displayName),
                                                isActive && React.createElement(
                                                    'svg',
                                                    {
                                                        xmlns: 'http://www.w3.org/2000/svg',
                                                        className: 'h-4 w-4 ml-2 text-blue-600',
                                                        viewBox: '0 0 20 20',
                                                        fill: 'currentColor'
                                                    },
                                                    React.createElement('path', {
                                                        fillRule: 'evenodd',
                                                        d: 'M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z',
                                                        clipRule: 'evenodd'
                                                    })
                                                )
                                            ),
                                            isActive && React.createElement(
                                                'div',
                                                { className: 'text-xs text-gray-500 normal-case mt-1' },
                                                `Filtrované: ${filteredValues}`
                                            )
                                        );
                                    })
                                )
                            ),
                            React.createElement(
                                'tbody',
                                { className: 'text-gray-600 text-sm font-light' },
                                filteredUsers.map((u) => ( // Používame filteredUsers
                                    React.createElement(
                                        'tr',
                                        { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.role || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.approved ? 'Áno' : 'Nie'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.registrationDate || '-'),
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
                )
            )
        )
    );
}

// Explicitne sprístupniť komponent globálne
window.AllRegistrationsApp = AllRegistrationsApp;
