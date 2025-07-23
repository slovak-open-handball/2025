// Tieto premenné sú teraz definované globálne v index.html a mali by byť prístupné.
// Odstránené duplicitné deklarácie:
// const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
// const firebaseConfig = { ... };
// const initialAuthToken = null;

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader; // Použijeme iný názov pre inštanciu aplikácie hlavičky
let authHeader;
let dbHeader;

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

let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(user, isRegistrationOpen) {
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    if (user) {
        // Používateľ je prihlásený
        if (authLink) authLink.classList.add('hidden');
        if (registerLink) registerLink.classList.add('hidden'); // Skryť registráciu, ak je prihlásený
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');
    } else {
        // Používateľ nie je prihlásený
        if (authLink) authLink.classList.remove('hidden');
        if (profileLink) profileLink.classList.add('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');

        // Zobraziť alebo skryť odkaz na registráciu podľa stavu registrácie
        if (registerLink) {
            if (isRegistrationOpen) {
                registerLink.classList.remove('hidden');
            } else {
                registerLink.classList.add('hidden');
            }
        }
    }
}

// Inicializácia poslucháča pre zmeny stavu autentifikácie v hlavičke
// Táto funkcia sa volá z index.html po načítaní hlavičky
function initializeHeaderLogic() {
    if (authHeader) {
        authHeader.onAuthStateChanged(user => {
            currentHeaderUser = user;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.error("Auth inštancia nie je definovaná v header.js.");
    }

    // Načítanie nastavení registrácie pre hlavičku
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
            console.error("Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
            currentIsRegistrationOpenStatus = false;
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        });
    } else {
        console.error("Firestore inštancia nie je definovaná v header.js.");
    }
}


// Spracovanie odhlásenia pre tlačidlo v hlavičke
// Používame DOMContentLoaded, aby sme sa uistili, že tlačidlo existuje
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    }
});
