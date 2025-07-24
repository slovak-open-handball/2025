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
        // Používame onIdTokenChanged, ktorý sa spustí pri zmene ID tokenu (vrátane zmeny hesla)
        authHeader.onIdTokenChanged(async (user) => {
            currentHeaderUser = user;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
            console.log("Header.js: onIdTokenChanged - Používateľ:", user ? user.uid : "null");

            if (user) {
                try {
                    // Pokúsime sa znova načítať údaje používateľa.
                    // Ak bolo heslo zmenené na inom zariadení, existujúci refresh token
                    // sa stane neplatným. `reload()` sa pokúsi obnoviť token a ak zlyhá
                    // kvôli neplatnému refresh tokenu, vyhodí chybu.
                    await user.reload(); 
                    console.log("Header.js: Používateľské údaje úspešne prečítané.");

                    // Ak sa sem dostaneme, token je stále platný alebo bol úspešne obnovený.
                    // To znamená, že heslo nebolo zmenené spôsobom, ktorý by invalidoval aktuálnu reláciu.
                    // Ak by bolo, `reload()` by zlyhal alebo `onIdTokenChanged` by sa spustil s `user=null`.

                } catch (reloadError) {
                    console.error("Header.js: Chyba pri načítaní používateľa po zmene ID tokenu (možno zmena hesla na inom zariadení):", reloadError);
                    // Ak sa `reload()` nepodarí (napr. kvôli invalidnému refresh tokenu po zmene hesla),
                    // odhlásime používateľa.
                    if (authHeader.currentUser) { // Skontrolujeme, či je používateľ stále prihlásený, aby sa predišlo chybám
                        await authHeader.signOut();
                        console.log("Header.js: Používateľ odhlásený kvôli potenciálnej zmene hesla na inom zariadení.");
                        window.location.href = 'login.html'; // Presmerovanie po odhlásení
                    }
                }
            } else {
                // Používateľ je null, čo znamená, že je odhlásený.
                // Toto sa stane, ak je token invalidovaný (vrátane zmeny hesla na inom zariadení).
                console.log("Header.js: Používateľ je odhlásený, token je invalidný.");
                // Nie je potrebné explicitne volať signOut(), ak je user už null.
                // Presmerovanie na login.html by sa malo stať už v rámci onAuthStateChanged
                // v iných komponentoch alebo pri pokuse o prístup k chráneným zdrojom.
                // Ak však chceme zabezpečiť okamžité presmerovanie z hlavičky, môžeme to urobiť:
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
