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
                    // Načítanie najnovších údajov používateľa
                    await user.reload();
                    const idTokenResult = await user.getIdTokenResult();
                    const currentAuthTime = idTokenResult.claims.auth_time; // auth_time je v sekundách

                    // Načítať posledný známy auth_time zo sessionStorage
                    const lastAuthTimeKey = `lastAuthTime_${user.uid}`;
                    const storedAuthTime = sessionStorage.getItem(lastAuthTimeKey);

                    if (storedAuthTime === null) {
                        // Prvé prihlásenie alebo prvá návšteva stránky v tejto relácii
                        sessionStorage.setItem(lastAuthTimeKey, currentAuthTime.toString());
                        console.log("Header.js: Uložený počiatočný auth_time pre používateľa.");
                    } else if (currentAuthTime > parseInt(storedAuthTime)) {
                        // Ak je aktuálny auth_time novší ako uložený, znamená to, že došlo k re-autentifikácii
                        // (napr. zmena hesla, prihlásenie na inom zariadení, atď.)
                        console.log("Header.js: Detekovaná zmena auth_time (novšia autentifikácia). Odhlasujem používateľa.");
                        await authHeader.signOut();
                        window.location.href = 'login.html'; // Presmerovanie po odhlásení
                        sessionStorage.removeItem(lastAuthTimeKey); // Vyčistíme uložený čas
                    } else if (currentAuthTime < parseInt(storedAuthTime)) {
                        // Toto by sa nemalo stať pri bežnej prevádzke, ak sa auth_time len zvyšuje.
                        // Mohlo by to naznačovať problém alebo manuálnu zmenu v storage.
                        // Pre istotu odhlásiť.
                        console.warn("Header.js: Detekovaný starší auth_time ako uložený. Odhlasujem používateľa.");
                        await authHeader.signOut();
                        window.location.href = 'login.html'; // Presmerovanie po odhlásení
                        sessionStorage.removeItem(lastAuthTimeKey); // Vyčistíme uložený čas
                    }
                    // Ak currentAuthTime === storedAuthTime, token sa len obnovil, netreba nič robiť.

                } catch (error) {
                    console.error("Header.js: Chyba pri kontrole auth_time alebo načítaní používateľa:", error);
                    // Ak nastane chyba pri reload() alebo getIdTokenResult() (napr. token je neplatný),
                    // to znamená, že relácia je pravdepodobne invalidovaná.
                    if (authHeader.currentUser) {
                        await authHeader.signOut();
                        console.log("Header.js: Používateľ odhlásený kvôli chybe pri overovaní tokenu.");
                        window.location.href = 'login.html';
                    }
                }
            } else {
                // Používateľ je null (odhlásený)
                console.log("Header.js: Používateľ je odhlásený, token je invalidný.");
                sessionStorage.removeItem(`lastAuthTime_${user ? user.uid : 'unknown'}`);
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
