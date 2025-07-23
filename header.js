// header.js

// Tieto premenné sú teraz definované globálne v index.html a mali by byť prístupné.
// Odstránené duplicitné deklarácie:
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

let firebaseAppHeader;
let authHeader;
let dbHeader;

// Flag to ensure initializeHeaderLogic runs only once
let headerLogicInitialized = false;

// Funkcia na inicializáciu Firebase a nastavenie poslucháčov pre hlavičku
function setupFirebaseForHeader() {
    // Ak už sú inštancie Firebase definované, preskočíme inicializáciu
    if (firebaseAppHeader && authHeader && dbHeader) {
        console.log("header.js: Firebase už je inicializovaná pre hlavičku.");
        return;
    }

    try {
        // Používame globálne premenné __firebase_config a __firebase_app_name
        const config = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const appName = typeof __firebase_app_name !== 'undefined' ? __firebase_app_name : 'headerApp';

        // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
        firebaseAppHeader = firebase.apps.find(app => app.name === appName);
        if (!firebaseAppHeader) {
            firebaseAppHeader = firebase.initializeApp(config, appName);
            console.log(`header.js: Firebase aplikácia '${appName}' inicializovaná.`);
        } else {
            console.log(`header.js: Používa sa existujúca Firebase aplikácia '${appName}'.`);
        }

        authHeader = firebase.auth(firebaseAppHeader); // Explicitne viažeme auth na pomenovanú aplikáciu
        dbHeader = firebase.firestore(firebaseAppHeader); // Explicitne viažeme firestore na pomenovanú aplikáciu

    } catch (e) {
        console.error("header.js: Chyba pri inicializácii Firebase:", e);
    }
}


let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(user, isRegistrationOpen) {
    console.log("updateHeaderLinks volaná. User:", user ? user.uid : "null", "isRegistrationOpen:", isRegistrationOpen);
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

    // Setup Firebase for header
    setupFirebaseForHeader();

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
