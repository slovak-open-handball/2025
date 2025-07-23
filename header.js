// header.js
// Používame globálne premenné poskytované Canvas prostredím, ak sú definované.
// Ak nie sú definované (napr. pri lokálnom testovaní mimo Canvas), použijeme zástupné hodnoty.
// Dôležité: Tieto premenné by mali byť definované globálne v prostredí Canvas alebo v hlavnom skripte.
// Ak nie sú, inicializácia Firebase zlyhá.
const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-header-app-id';
const canvasFirebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const canvasInitialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let firebaseAppHeader;
let authHeader;
let dbHeader;

// Funkcia na inicializáciu Firebase pre hlavičku, ktorá čaká na dostupnosť 'firebase' globálneho objektu
function initializeFirebaseForHeader() {
    // Kontrola, či je Firebase SDK načítané
    if (typeof firebase === 'undefined' || !firebase.initializeApp) {
        console.warn("header.js: Firebase SDK ešte nie je načítaný. Opakujem inicializáciu o 100ms.");
        setTimeout(initializeFirebaseForHeader, 100); // Skúsiť znova o chvíľu
        return;
    }

    // Kontrola, či je dostupná Firebase konfigurácia
    if (!canvasFirebaseConfig) {
        console.error("header.js: Firebase konfigurácia (__firebase_config) nie je dostupná. Inicializácia zlyhala.");
        return;
    }

    try {
        // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom ('headerApp')
        // Ak nie, inicializujeme novú inštanciu s jedinečným názvom.
        firebaseAppHeader = firebase.apps.find(app => app.name === 'headerApp') || firebase.initializeApp(canvasFirebaseConfig, 'headerApp');
        authHeader = firebase.auth(firebaseAppHeader);
        dbHeader = firebase.firestore(firebaseAppHeader);
        console.log("header.js: Firebase aplikácia pre hlavičku inicializovaná.");

        // Prihlásenie s custom tokenom, ak je k dispozícii, inak anonymne
        // Používame authHeader pre prihlásenie
        if (canvasInitialAuthToken) {
            authHeader.signInWithCustomToken(canvasInitialAuthToken)
                .then(() => console.log("header.js: Prihlásenie custom tokenom pre hlavičku úspešné."))
                .catch(error => console.error("header.js: Chyba pri prihlásení custom tokenom pre hlavičku:", error));
        } else {
            authHeader.signInAnonymously()
                .then(() => console.log("header.js: Prihlásenie anonymne pre hlavičku úspešné."))
                .catch(error => console.error("header.js: Chyba pri anonymnom prihlásení pre hlavičku:", error));
        }

        // Akonáhle je Firebase inicializované, môžeme spustiť hlavnú logiku hlavičky
        initializeHeaderLogicInternal();

    } catch (e) {
        console.error("header.js: Chyba pri inicializácii Firebase pre hlavičku:", e);
    }
}

let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(user, isRegistrationOpen) {
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    // Viditeľnosť odkazu na registráciu na základe stavu registrácie
    if (registerLink) {
        if (isRegistrationOpen) {
            registerLink.classList.remove('hidden');
        } else {
            registerLink.classList.add('hidden');
        }
    }

    if (user) {
        // Používateľ je prihlásený (anonymne alebo s povereniami)
        if (user.isAnonymous) {
            // Anonymný používateľ: zobraziť prihlásenie, skryť profil a odhlásenie
            if (profileLink) profileLink.classList.add('hidden');
            if (logoutButton) logoutButton.classList.add('hidden');
            if (authLink) authLink.classList.remove('hidden'); // Zobraziť prihlásenie pre anonymného používateľa
        } else {
            // Autentifikovaný používateľ (nie anonymný): zobraziť profil a odhlásenie, skryť prihlásenie
            if (profileLink) profileLink.classList.remove('hidden');
            if (logoutButton) logoutButton.classList.remove('hidden');
            if (authLink) authLink.classList.add('hidden');
        }
    } else {
        // Žiadny používateľ nie je prihlásený: skryť profil a odhlásenie, zobraziť prihlásenie
        if (profileLink) profileLink.classList.add('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');
        if (authLink) authLink.classList.remove('hidden');
    }
}

// Interná funkcia pre logiku hlavičky, spúšťa sa po inicializácii Firebase
function initializeHeaderLogicInternal() {
    // Listener pre zmeny stavu autentifikácie
    authHeader.onAuthStateChanged(user => {
        currentHeaderUser = user;
        console.log("header.js: onAuthStateChanged - Používateľ:", user ? user.uid : "Žiadny");
        // Aktualizovať odkazy na základe stavu používateľa a registrácie
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    });

    // Listener pre nastavenia registrácie z Firestore
    const docRef = dbHeader.collection('settings').doc('registration');
    docRef.onSnapshot(docSnapshot => {
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
}

// Spracovanie odhlásenia pre tlačidlo v hlavičke
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

// Spustiť inicializáciu Firebase hneď po načítaní header.js
// Toto sa bude opakovať, kým nebude Firebase SDK k dispozícii.
initializeFirebaseForHeader();
