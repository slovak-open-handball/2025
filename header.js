// header.js
// Tento súbor predpokladá, že __app_id, __firebase_config, __initial_auth_token a __firebase_app_name
// sú globálne definované v <head> hlavného HTML súboru.

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader;
let authHeader;
let dbHeader;

// Pomocná funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(currentUser, isRegistrationOpenStatus) {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (authLink && profileLink && logoutButton && registerLink) {
        if (currentUser) { // Ak je používateľ prihlásený
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            registerLink.classList.add('hidden'); // Skryť registračný odkaz, ak je prihlásený
        } else { // Ak používateľ nie je prihlásený
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            if (isRegistrationOpenStatus) {
                registerLink.classList.remove('hidden');
            } else {
                registerLink.classList.add('hidden');
            }
        }
    } else {
        console.warn("Header.js: Niektoré navigačné odkazy neboli nájdené.");
    }
}

// Globálne premenné na uchovávanie stavu pre hlavičku (zjednodušené, nie React stav)
let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;
let unsubscribePasswordCheck = null; // Pre uloženie unsubscribera pre Firestore listener

// Funkcia na inicializáciu logiky hlavičky závislej od DOM
function initializeHeaderLogic() {
    console.log("Header.js: initializeHeaderLogic spustená.");

    // Inicializácia Firebase pre hlavičku
    try {
        // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
        try {
            firebaseAppHeader = firebase.app(headerAppName); // Pokúsime sa získať existujúcu pomenovanú aplikáciu
        } catch (e) {
            // Ak pomenovaná aplikácia neexistuje, inicializujeme ju
            firebaseAppHeader = firebase.initializeApp(firebaseConfig, headerAppName);
        }
        
        authHeader = firebase.auth(firebaseAppHeader);
        dbHeader = firebase.firestore(firebaseAppHeader);
        console.log("Header.js: Firebase inicializovaná pre hlavičku.");

    } catch (e) {
        console.error("Header.js: Chyba pri inicializácii Firebase pre hlavičku:", e);
        // Ak inicializácia zlyhá, uistite sa, že authHeader a dbHeader sú null
        authHeader = null;
        dbHeader = null;
    }

    // Počúvanie zmien stavu autentifikácie
    if (authHeader) {
        authHeader.onIdTokenChanged(async (user) => {
            currentHeaderUser = user;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
            console.log("Header.js: onIdTokenChanged - Používateľ:", user ? user.uid : "null");

            // Odhlásime predchádzajúci listener pre zmenu hesla, ak existuje
            if (unsubscribePasswordCheck) {
                unsubscribePasswordCheck();
                unsubscribePasswordCheck = null;
                console.log("Header.js: Odhlásený predchádzajúci listener pre zmenu hesla.");
            }

            if (user && dbHeader) {
                // Ak je používateľ prihlásený, nastavíme listener na jeho dokument pre zmenu hesla
                const userDocRef = dbHeader.collection('users').doc(user.uid);
                
                unsubscribePasswordCheck = userDocRef.onSnapshot(async (docSnapshot) => {
                    if (docSnapshot.exists) {
                        const userData = docSnapshot.data();
                        const firestorePasswordChangedTime = userData.passwordLastChanged ? userData.passwordLastChanged.toDate().getTime() : 0;
                        const localStorageKey = `passwordLastChanged_${user.uid}`;
                        const storedPasswordChangedTime = parseInt(localStorage.getItem(localStorageKey) || '0', 10);

                        console.log(`Header.js: Firestore passwordLastChanged: ${firestorePasswordChangedTime}, Stored: ${storedPasswordChangedTime}`);

                        if (firestorePasswordChangedTime > storedPasswordChangedTime) {
                            // Heslo bolo zmenené na inom zariadení alebo v inej relácii
                            console.log("Header.js: Detekovaná zmena hesla na inom zariadení/relácii. Odhlasujem používateľa.");
                            await authHeader.signOut();
                            window.location.href = 'login.html'; // Presmerovanie po odhlásení
                            localStorage.removeItem(localStorageKey); // Vyčistíme lokálny storage
                        } else if (firestorePasswordChangedTime === 0 && storedPasswordChangedTime !== 0) {
                            // Ak vo Firestore nie je timestamp, ale v lokálnom storage je,
                            // môže to znamenať reset alebo chybu, pre istotu odhlásiť.
                             console.warn("Header.js: Nesúlad timestampov zmeny hesla. Odhlasujem používateľa.");
                             await authHeader.signOut();
                             window.location.href = 'login.html';
                             localStorage.removeItem(localStorageKey);
                        } else {
                            // Aktualizujeme lokálny storage s najnovším časom z Firestore
                            localStorage.setItem(localStorageKey, firestorePasswordChangedTime.toString());
                            console("Header.js: Aktualizovaný lokálny timestamp zmeny hesla.");
                        }
                    } else {
                        // Ak používateľský dokument neexistuje, alebo bol zmazaný, odhlásiť
                        console.warn("Header.js: Používateľský dokument sa nenašiel. Odhlasujem používateľa.");
                        await authHeader.signOut();
                        window.location.href = 'login.html';
                    }
                }, async (error) => {
                    console.error("Header.js: Chyba pri počúvaní zmien používateľského dokumentu Firestore:", error);
                    // Ak nastane chyba pri počúvaní Firestore (napr. povolenia, sieť), odhlásiť
                    if (authHeader.currentUser) {
                        await authHeader.signOut();
                        console.log("Header.js: Používateľ odhlásený kvôli chybe Firestore listenera.");
                        window.location.href = 'login.html';
                    }
                });
            } else {
                // Používateľ je null (odhlásený) alebo dbHeader nie je k dispozícii
                console.log("Header.js: Používateľ je odhlásený alebo DB nie je k dispozícii.");
                // Vyčistíme lokálny storage pre zmenu hesla, ak existuje UID
                if (user && user.uid) {
                    localStorage.removeItem(`passwordLastChanged_${user.uid}`);
                }
                
                if (window.location.pathname !== '/login.html' && window.location.pathname !== '/register.html') {
                    window.location.href = 'login.html';
                }
            }
        });

        // Počiatočné prihlásenie pre hlavičku (ak existuje vlastný token)
        if (initialAuthToken) {
            authHeader.signInWithCustomToken(initialAuthToken).catch(e => {
                console.error("Header.js: Chyba pri počiatočnom prihlásení Firebase pre hlavičku:", e);
            });
        }
    } else {
        console.warn("Header.js: Auth inštancia nie je dostupná pre onIdTokenChanged.");
    }

    // Počúvanie zmien nastavení registrácie
    if (dbHeader) {
        const settingsDocRef = dbHeader.collection('settings').doc('registration');
        settingsDocRef.onSnapshot(docSnapshot => {
            if (docSnapshot.exists) {
                const data = docSnapshot.data();
                const regStart = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
                const regEnd = data.registrationEndDate ? data.registrationEndDate.toDate() : null;
                const now = new Date();

                const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
                const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

                currentIsRegistrationOpenStatus = (
                    (isRegStartValid ? now >= regStart : true) &&
                    (isRegEndValid ? now <= regEnd : true)
                );
            } else {
                currentIsRegistrationOpenStatus = false; // Predvolene zatvorené, ak sa nastavenia nenašli
            }
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        }, error => {
            console.error("Header.js: Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
            currentIsRegistrationOpenStatus = false;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.warn("Header.js: Firestore inštancia nie je dostupná pre načítanie nastavení.");
    }

    // Spracovanie odhlásenia pre tlačidlo v hlavičke
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Header.js: Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    }
}

// Sprístupnenie funkcie globálne, aby ju mohol volať register.html
window.initializeHeaderLogic = initializeHeaderLogic;
