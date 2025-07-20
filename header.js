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
} catch (e) {
    console.error("Chyba pri inicializácii Firebase pre hlavičku:", e);
}

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
    }
}

// Globálne premenné na uchovávanie stavu pre hlavičku (zjednodušené, nie React stav)
let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Počúvanie zmien stavu autentifikácie
if (authHeader) {
    authHeader.onAuthStateChanged((user) => {
        currentHeaderUser = user;
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    });

    // Počiatočné prihlásenie pre hlavičku (ak existuje vlastný token)
    if (initialAuthToken) {
        authHeader.signInWithCustomToken(initialAuthToken).catch(e => {
            console.error("Chyba pri počiatočnom prihlásení Firebase pre hlavičku:", e);
        });
    }
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
