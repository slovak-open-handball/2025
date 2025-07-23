// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú duplikované tu, aby bol header.js samostatný.
// Pre Canvas prostredie budú globálne premenné __app_id, __firebase_config, __initial_auth_token
const appId = typeof __app_id !== 'undefined' ? __app_id : '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader; // Použijeme iný názov pre inštanciu aplikácie hlavičky
let authHeader;
let dbHeader;

try {
    // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
    // Používame názov 'headerApp' pre túto inštanciu, aby sa nekolidovala s inými inštanciami
    firebaseAppHeader = firebase.apps.find(app => app.name === 'headerApp') || firebase.initializeApp(firebaseConfig, 'headerApp');
    authHeader = firebase.auth(firebaseAppHeader);
    dbHeader = firebase.firestore(firebaseAppHeader);
    console.log("Header: Firebase inicializovaná pre hlavičku.");
} catch (e) {
    console.error("Header: Chyba pri inicializácii Firebase pre hlavičku:", e);
}

let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

/**
 * Aktualizuje viditeľnosť odkazov v hlavičke na základe stavu používateľa a registrácie.
 * @param {firebase.User|null} user Aktuálne prihlásený používateľ Firebase.
 * @param {boolean} isRegistrationOpen True, ak je registrácia otvorená, inak false.
 */
function updateHeaderLinks(user, isRegistrationOpen) {
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    if (registerLink) {
        if (isRegistrationOpen) {
            registerLink.classList.remove('hidden');
        } else {
            registerLink.classList.add('hidden');
        }
    }

    if (user) {
        profileLink?.classList.remove('hidden');
        authLink?.classList.add('hidden');
        logoutButton?.classList.remove('hidden');
    } else {
        profileLink?.classList.add('hidden');
        authLink?.classList.remove('hidden');
        logoutButton?.classList.add('hidden');
    }
    console.log(`Header: Odkazy aktualizované. Prihlásený: ${!!user}, Registrácia otvorená: ${isRegistrationOpen}`);
}

/**
 * Načíta nastavenia registrácie a sleduje stav autentifikácie používateľa.
 * Nastaví poslucháčov na Firestore a Auth.
 */
function loadRegistrationSettingsAndUser() {
    if (!dbHeader || !authHeader) {
        console.error("Header: Firebase DB alebo Auth nie sú inicializované. Nemôžem načítať nastavenia.");
        return;
    }

    // Poslucháč pre zmeny stavu autentifikácie
    authHeader.onAuthStateChanged(user => {
        currentHeaderUser = user;
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        console.log("Header: Stav autentifikácie zmenený, používateľ:", user ? user.uid : "null");
    });

    // Poslucháč pre zmeny v nastaveniach registrácie
    dbHeader.collection('settings').doc('registration').onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            const regStart = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
            const regEnd = data.registrationEndDate ? data.registrationEndDate.toDate() : null;
            const now = new Date();

            const isRegStartValid = regStart instanceof Date && !isNaN(regStart);
            const isRegEndValid = regEnd instanceof Date && !isNaN(regEnd);

            currentIsRegistrationOpenStatus = (
                (isRegStartValid ? now >= regStart : true) && // Ak nie je definovaný štart, považuje sa za otvorenú od začiatku
                (isRegEndValid ? now <= regEnd : true)       // Ak nie je definovaný koniec, považuje sa za otvorenú navždy
            );
            console.log(`Header: Nastavenia registrácie aktualizované. Otvorená: ${currentIsRegistrationOpenStatus}`);
        } else {
            currentIsRegistrationOpenStatus = false; // Predvolene zatvorené, ak sa nastavenia nenašli
            console.warn("Header: Nastavenia registrácie nenájdené v Firestore. Registrácia je zatvorená.");
        }
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    }, error => {
        console.error("Header: Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
        currentIsRegistrationOpenStatus = false;
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    });
}

/**
 * Hlavná inicializačná funkcia pre logiku hlavičky.
 * Volá sa po načítaní a vložení header.html do DOM.
 */
function initializeHeaderLogic() {
    console.log("Header: Inicializujem logiku hlavičky.");
    loadRegistrationSettingsAndUser(); // Spustí načítanie nastavení a poslucháčov
    
    // Spracovanie odhlásenia pre tlačidlo v hlavičke
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                    console.log("Header: Používateľ úspešne odhlásený.");
                } catch (e) {
                    console.error("Header: Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    } else {
        console.warn("Header: Tlačidlo 'Odhlásenie' nenájdené.");
    }
}

// Sprístupní funkciu globálne, aby ju mohli volať iné skripty (napr. z HTML)
window.initializeHeaderLogic = initializeHeaderLogic;
