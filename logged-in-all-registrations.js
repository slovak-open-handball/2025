// logged-in-all-registrations.js
// Tento súbor predpokladá, že firebaseConfig, initialAuthToken a appId
// sú globálne definované v <head> logged-in-all-registrations.html.

// NotificationModal Component (pre konzistentné notifikácie)
function NotificationModal({ message, onClose, displayNotificationsEnabled }) {
    const [show, setShow] = React.useState(false);
    const timerRef = React.useRef(null);

    React.useEffect(() => {
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
    }, [message, onClose, displayNotificationsEnabled]);

    if (!show && !message || !displayNotificationsEnabled) return null;

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
    const [userNotificationMessage, setUserNotificationMessage] = React.useState('');

    const [allUsers, setAllUsers] = React.useState([]); // Stav pre všetkých používateľov z databázy

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
            // Používame globálnu premennú firebaseConfig namiesto __firebase_config
            if (firebase.apps.length === 0) {
                firebaseAppInstance = firebase.initializeApp(firebaseConfig);
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
                    // initialAuthToken je definovaný v HTML, ale pre túto stránku ho nepoužívame na automatické prihlásenie
                    // Používateľ by mal byť už prihlásený z predchádzajúcej stránky.
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
    }, []); // Prázdne pole závislostí - spustí sa len raz pri mountovaní komponentu

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
    }, [db, userProfileData]); // Závisí od db a userProfileData (pre rolu admina)

    // Handle logout (potrebné pre tlačidlo odhlásenia v hlavičke)
    const handleLogout = React.useCallback(async () => {
        if (!auth) return;
        try {
            setLoading(true);
            await auth.signOut();
            setUserNotificationMessage("Úspešne odhlásený.");
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
        window.location.href = 'logged-in-my-data.html'; // Presmerovanie na logged-in-my-data.html
        return null;
    }

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center font-inter overflow-y-auto' },
        React.createElement(NotificationModal, {
            message: userNotificationMessage,
            onClose: () => setUserNotificationMessage(''),
            displayNotificationsEnabled: userProfileData.displayNotifications // Odovzdávame stav notifikácií
        }),
        React.createElement(
            'div',
            { className: 'w-full max-w-full px-4 mt-8 mb-10' }, {/* Zmenené max-w-4xl na max-w-full a pridaný px-4 */}
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
                allUsers.length === 0 && !loading ? (
                    React.createElement('p', { className: 'text-center text-gray-600' }, 'Žiadne registrácie na zobrazenie.')
                ) : (
                    React.createElement(
                        'div',
                        { className: 'overflow-x-auto' }, {/* Umožňuje horizontálny scroll pre veľké tabuľky */}
                        React.createElement(
                            'table',
                            { className: 'min-w-full bg-white rounded-lg shadow-md' },
                            React.createElement(
                                'thead',
                                null,
                                React.createElement(
                                    'tr',
                                    { className: 'w-full bg-gray-200 text-gray-600 uppercase text-sm leading-normal' },
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'E-mail'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Meno'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Priezvisko'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Telefón'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Rola'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Schválený'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Dátum registrácie'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Posledná zmena hesla'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Názov klubu'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'IČO'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'DIČ'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'IČ DPH'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Ulica'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Popisné číslo'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Mesto'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'PSČ'),
                                    React.createElement('th', { className: 'py-3 px-6 text-left' }, 'Krajina')
                                )
                            ),
                            React.createElement(
                                'tbody',
                                { className: 'text-gray-600 text-sm font-light' },
                                allUsers.map((u) => (
                                    React.createElement(
                                        'tr',
                                        { key: u.id, className: 'border-b border-gray-200 hover:bg-gray-100' },
                                        React.createElement('td', { className: 'py-3 px-6 text-left whitespace-nowrap' }, u.email || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.firstName || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.lastName || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.contactPhoneNumber || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.role || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.approved ? 'Áno' : 'Nie'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.registrationDate || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.passwordLastChanged || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.billing?.clubName || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.billing?.ico || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.billing?.dic || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.billing?.icDph || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.street || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.houseNumber || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.city || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.postalCode || '-'),
                                        React.createElement('td', { className: 'py-3 px-6 text-left' }, u.country || '-')
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
