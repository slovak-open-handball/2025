// header.js

// Tieto premenné sú definované globálne v index.html a mali by byť prístupné.
// const __app_id, __firebase_config, __initial_auth_token, __firebase_app_name

let firebaseAppHeader; // Toto bude teraz odkazovať na predvolenú aplikáciu
let authHeader;
let dbHeader;

// Flag na zabezpečenie, že initializeHeaderLogic sa spustí iba raz
let headerLogicInitialized = false;

// Funkcia na získanie inštancií Firebase (mala by byť volaná po načítaní Firebase SDK a inicializácii predvolenej aplikácie)
function getFirebaseInstances() {
    try {
        // Pokúste sa získať predvolenú inštanciu Firebase aplikácie
        firebaseAppHeader = firebase.app(); // Získať predvolenú aplikáciu
        authHeader = firebase.auth(); // Získať auth pre predvolenú aplikáciu
        dbHeader = firebase.firestore(); // Získať firestore pre predvolenú aplikáciu
        console.log("header.js: Získané Firebase inštancie (predvolená aplikácia).");
    } catch (e) {
        console.error("header.js: Chyba pri získavaní Firebase inštancií:", e);
        // Fallback: ak predvolená aplikácia nie je inicializovaná, skúste ju inicializovať
        // (toto by sa však ideálne nemalo stať, ak sa index.html načíta správne)
        if (typeof __firebase_config !== 'undefined') {
            try {
                const config = JSON.parse(__firebase_config);
                firebaseAppHeader = firebase.initializeApp(config, '[DEFAULT]'); // Skúste inicializovať predvolenú, ak nebola nájdená
                authHeader = firebase.auth(firebaseAppHeader);
                dbHeader = firebase.firestore(firebaseAppHeader);
                console.warn("header.js: Predvolená Firebase aplikácia inicializovaná ako fallback.");
            } catch (initError) {
                console.error("header.js: Chyba pri inicializácii Firebase ako fallback:", initError);
            }
        }
    }
}

let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(user, isRegistrationOpen) {
    console.log("updateHeaderLinks volaná. Používateľ:", user ? user.uid : "null", "Je registrácia otvorená:", isRegistrationOpen);
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    if (user) {
        // Používateľ je prihlásený
        if (authLink) authLink.classList.add('hidden'); // Skryť Prihlásenie
        if (registerLink) registerLink.classList.add('hidden'); // Skryť Registráciu na turnaj
        if (profileLink) profileLink.classList.remove('hidden'); // Zobraziť Moja zóna
        if (logoutButton) logoutButton.classList.remove('hidden'); // Zobraziť Odhlásenie
        console.log("Header linky: Prihlásený - Moja zóna a Odhlásenie viditeľné.");
    } else {
        // Používateľ nie je prihlásený
        if (authLink) authLink.classList.remove('hidden'); // Zobraziť Prihlásenie
        if (profileLink) profileLink.classList.add('hidden'); // Skryť Moja zóna
        if (logoutButton) logoutButton.classList.add('hidden'); // Skryť Odhlásenie

        // Zobraziť alebo skryť odkaz na registráciu podľa stavu registrácie
        if (registerLink) {
            if (isRegistrationOpen) {
                registerLink.classList.remove('hidden'); // Zobraziť Registráciu na turnaj
                console.log("Header linky: Odhlásený, registrácia otvorená - Prihlásenie a Registrácia viditeľné.");
            } else {
                registerLink.classList.add('hidden'); // Skryť Registráciu na turnaj
                console.log("Header linky: Odhlásený, registrácia zatvorená - Iba Prihlásenie viditeľné.");
            }
        } else {
            console.log("Header linky: Odhlásený - Iba Prihlásenie viditeľné.");
        }
    }
}

// Funkcia na inicializáciu poslucháčov a logiky hlavičky
function initializeHeaderLogic() {
    if (headerLogicInitialized) {
        console.log("header.js: initializeHeaderLogic už bola spustená.");
        return;
    }
    headerLogicInitialized = true;
    console.log("header.js: Spúšťam initializeHeaderLogic.");

    // Získajte Firebase inštancie
    getFirebaseInstances(); // Volajte túto funkciu tu, aby ste zabezpečili dostupnosť inštancií

    if (authHeader) {
        authHeader.onAuthStateChanged(user => {
            currentHeaderUser = user;
            console.log("header.js: onAuthStateChanged - Používateľ:", user ? user.uid : "null");
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.error("header.js: Auth inštancia nie je definovaná.");
    }

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
            console.log("header.js: onSnapshot - Stav registrácie:", currentIsRegistrationOpenStatus);
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        }, error => {
            console.error("header.js: Chyba pri načítaní nastavení registrácie (onSnapshot):", error);
            currentIsRegistrationOpenStatus = false;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.error("header.js: Firestore inštancia nie je definovaná.");
    }

    // Spracovanie odhlásenia pre tlačidlo v hlavičke
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) {
                try {
                    await authHeader.signOut();
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    } else {
        console.log("header.js: Tlačidlo pre odhlásenie nebolo nájdené.");
    }
}

// Spustí initializeHeaderLogic, keď je DOM plne načítaný.
// Toto zabezpečí, že sa hlavička inicializuje aj na stránkach,
// kde nie je dynamicky načítaná cez loadHeader().
document.addEventListener('DOMContentLoaded', () => {
    // Ak header-placeholder neexistuje, znamená to, že header.html je pravdepodobne priamo vložený.
    // V takom prípade voláme initializeHeaderLogic priamo.
    // Ak header-placeholder existuje, očakávame, že initializeHeaderLogic bude volaná z hlavného skriptu (napr. index.html).
    if (!document.getElementById('header-placeholder')) {
        console.log("header.js: 'header-placeholder' nenájdený, volám initializeHeaderLogic pri DOMContentLoaded.");
        initializeHeaderLogic();
    } else {
        console.log("header.js: 'header-placeholder' nájdený, očakávam, že initializeHeaderLogic bude volaná z hlavného skriptu (napr. index.html).");
    }
});
