// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú duplikované tu, aby bol header.js samostatný.
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppHeader; // Použijeme iný názov pre inštanciu aplikácie hlavičky
let authHeader;
let dbHeader;

try {
    // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
    firebaseAppHeader = firebase.apps.find(app => app.name === 'headerApp') || firebase.initializeApp(firebaseConfig, 'headerApp');
    authHeader = firebase.auth(firebaseAppHeader);
    dbHeader = firebase.firestore(firebaseAppHeader);
    console.log("header.js: Firebase aplikácia pre hlavičku inicializovaná.");
} catch (e) {
    console.error("header.js: Chyba pri inicializácii Firebase pre hlavičku:", e);
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

// Inicializácia logiky hlavičky, volaná z index.html po načítaní hlavičky
function initializeHeaderLogic() {
    if (!authHeader || !dbHeader) {
        console.error("header.js: Firebase Auth alebo Firestore nie je inicializovaný pre hlavičku.");
        return;
    }

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
