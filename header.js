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
    console.log("Header.js: Firebase inicializovaný.");
} catch (e) {
    console.error("Header.js: Chyba pri inicializácii Firebase pre hlavičku:", e);
}

// Pomocná funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(currentUser, isRegistrationOpenStatus) {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    console.log("Header.js: updateHeaderLinks volaný s:", { currentUser: currentUser ? currentUser.uid : null, isRegistrationOpenStatus });

    if (authLink && profileLink && logoutButton && registerLink) {
        if (currentUser) { // Ak je používateľ prihlásený (akýkoľvek typ, vrátane anonymného, ak by bol povolený)
            // Pre prihláseného používateľa: zobraziť "Moja zóna" a "Odhlásenie"
            authLink.classList.add('hidden'); // Skryť "Prihlásenie"
            profileLink.classList.remove('hidden'); // Zobraziť "Moja zóna"
            logoutButton.classList.remove('hidden'); // Zobraziť "Odhlásenie"
            registerLink.classList.add('hidden'); // Skryť "Registrácia na turnaj"
            console.log("Header.js: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
        } else { // Ak používateľ nie je prihlásený
            // Pre neprihláseného používateľa: zobraziť "Prihlásenie"
            authLink.classList.remove('hidden'); // Zobraziť "Prihlásenie"
            profileLink.classList.add('hidden'); // Skryť "Moja zóna"
            logoutButton.classList.add('hidden'); // Skryť "Odhlásenie"
            console.log("Header.js: Používateľ odhlásený. Skryté: Moja zóna, Odhlásenie. Zobrazené: Prihlásenie.");

            // Zobraziť "Registrácia na turnaj" len ak je registrácia otvorená
            if (isRegistrationOpenStatus) {
                registerLink.classList.remove('hidden');
                console.log("Header.js: Registrácia otvorená. Zobrazené: Registrácia na turnaj.");
            } else {
                registerLink.classList.add('hidden');
                console.log("Header.js: Registrácia zatvorená. Skryté: Registrácia na turnaj.");
            }
        }
        console.log("Header.js: Aktuálne triedy odkazov - Auth:", authLink.classList.contains('hidden') ? 'hidden' : 'visible', "Profile:", profileLink.classList.contains('hidden') ? 'hidden' : 'visible', "Logout:", logoutButton.classList.contains('hidden') ? 'hidden' : 'visible', "Register:", registerLink.classList.contains('hidden') ? 'hidden' : 'visible');
    } else {
        console.warn("Header.js: Niektoré elementy hlavičky neboli nájdené v DOM.");
    }
}

// Globálne premenné na uchovávanie stavu pre hlavičku (zjednodušené, nie React stav)
let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;
let authStateInitialized = false; // Nová premenná na sledovanie inicializácie stavu autentifikácie
let settingsStateInitialized = false; // Nová premenná na sledovanie inicializácie stavu nastavení

// Počúvanie zmien stavu autentifikácie
if (authHeader) {
    authHeader.onAuthStateChanged((user) => {
        currentHeaderUser = user;
        authStateInitialized = true; // Označiť stav autentifikácie ako inicializovaný
        console.log("Header.js: onAuthStateChanged - Používateľ:", user ? user.uid : "null", "AuthStateInitialized:", authStateInitialized);

        // Ak používateľ je odhlásený a nie je na povolených stránkach, presmerovať na login.html
        const currentPathname = window.location.pathname;
        const allowedPaths = ['/login.html', '/register.html', '/index.html', '/admin-register.html', '/']; // Pridal som aj '/' pre úvodnú stránku
        if (!user && !allowedPaths.includes(currentPathname)) {
            console.log("Header.js: Používateľ odhlásený, presmerovanie na login.html z header.js. Aktuálna cesta:", currentPathname);
            window.location.href = 'login.html';
        }
        // Aktualizovať odkazy len ak sú oba stavy inicializované
        if (authStateInitialized && settingsStateInitialized) {
            console.log("Header.js: Oba stavy inicializované (Auth, Settings). Volám updateHeaderLinks z onAuthStateChanged.");
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        } else {
            console.log("Header.js: Čakám na inicializáciu oboch stavov. AuthStateInitialized:", authStateInitialized, "SettingsStateInitialized:", settingsStateInitialized);
        }
    });

    // Počiatočné prihlásenie pre hlavičku (ak existuje vlastný token)
    if (initialAuthToken) {
        authHeader.signInWithCustomToken(initialAuthToken).catch(e => {
            console.error("Header.js: Chyba pri počiatočnom prihlásení Firebase pre hlavičku:", e);
        });
    }
} else {
    console.error("Header.js: authHeader nie je inicializovaný. onAuthStateChanged nebude spustený.");
}

// Počúvanie zmien nastavení registrácie
if (dbHeader) {
    const settingsDocRef = dbHeader.collection('settings').doc('registration');
    settingsDocRef.onSnapshot(docSnapshot => {
        console.log("Header.js: onSnapshot pre nastavenia registrácie.");
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
            console.log("Header.js: Nastavenia registrácie načítané. isRegistrationOpenStatus:", currentIsRegistrationOpenStatus);
        } else {
            currentIsRegistrationOpenStatus = false; // Predvolene zatvorené, ak sa nastavenia nenašli
            console.log("Header.js: Nastavenia registrácie sa nenašli. isRegistrationOpenStatus nastavené na false.");
        }
        settingsStateInitialized = true; // Označiť stav nastavení ako inicializovaný
        console.log("Header.js: SettingsStateInitialized:", settingsStateInitialized);

        // Aktualizovať odkazy len ak sú oba stavy inicializované
        if (authStateInitialized && settingsStateInitialized) {
            console.log("Header.js: Oba stavy inicializované (Auth, Settings). Volám updateHeaderLinks z onSnapshot.");
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        } else {
            console.log("Header.js: Čakám na inicializáciu oboch stavov. AuthStateInitialized:", authStateInitialized, "SettingsStateInitialized:", settingsStateInitialized);
        }
    }, error => {
        console.error("Header.js: Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
        currentIsRegistrationOpenStatus = false;
        settingsStateInitialized = true; // Označiť stav nastavení ako inicializovaný aj pri chybe
        if (authStateInitialized && settingsStateInitialized) {
            updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
        }
    });
} else {
    console.error("Header.js: dbHeader nie je inicializovaný. onSnapshot pre nastavenia nebude spustený.");
}

// Spracovanie odhlásenia pre tlačidlo v hlavičke
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            if (authHeader) { // Používame authHeader
                try {
                    await authHeader.signOut();
                    console.log("Header.js: Používateľ odhlásený kliknutím na tlačidlo.");
                    window.location.href = 'login.html'; // Presmerovanie po odhlásení
                } catch (e) {
                    console.error("Header.js: Chyba pri odhlásení z hlavičky:", e);
                }
            }
        });
    } else {
        console.warn("Header.js: Tlačidlo pre odhlásenie (#logout-button) nebolo nájdené v DOM.");
    }
});
