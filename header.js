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
let firebaseAppHeader;
let authHeader;
let dbHeader;

try {
    // Získame existujúcu predvolenú Firebase aplikáciu.
    // Očakávame, že bola inicializovaná v <head> hlavného HTML súboru.
    firebaseAppHeader = firebase.app();
    authHeader = firebase.auth(firebaseAppHeader);
    dbHeader = firebase.firestore(firebaseAppHeader);
    console.log("Header.js: Získaná existujúca predvolená Firebase app inštancia.");
} catch (e) {
    console.error("Header.js: Chyba pri získavaní Firebase app inštancie. Uistite sa, že Firebase je inicializovaná v <head>.", e);
    // V prípade chyby (napr. Firebase nie je vôbec načítaná), nastavíme authHeader a dbHeader na null,
    // aby sa predišlo ďalším chybám.
    authHeader = null;
    dbHeader = null;
}

let currentHeaderUser = null;
let currentIsRegistrationOpenStatus = false;

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks(user, isRegistrationOpen) {
    console.log(`Header.js: updateHeaderLinks volaný s: {currentUser: ${user ? user.uid : 'null'}, isRegistrationOpenStatus: ${isRegistrationOpen}}`);
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');

    if (!authLink || !profileLink || !logoutButton || !registerLink) {
        console.warn("Header.js: Niektoré navigačné odkazy neboli nájdené.");
        return;
    }

    if (user) {
        // Používateľ je prihlásený
        authLink.classList.add('hidden');
        profileLink.classList.remove('hidden');
        logoutButton.classList.remove('hidden');
        registerLink.classList.add('hidden'); // Prihlásený používateľ nepotrebuje registračný odkaz
        console.log("Header.js: Používateľ prihlásený. Skryté: Prihlásenie, Registrácia. Zobrazené: Moja zóna, Odhlásenie.");
    } else {
        // Používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink.classList.add('hidden');
        logoutButton.classList.add('hidden');
        if (isRegistrationOpen) {
            registerLink.classList.remove('hidden');
            console.log("Header.js: Používateľ odhlásený, registrácia otvorená. Zobrazené: Prihlásenie, Registrácia.");
        } else {
            registerLink.classList.add('hidden');
            console.log("Header.js: Používateľ odhlásený, registrácia zatvorená. Zobrazené: Prihlásenie. Skryté: Registrácia.");
        }
    }
    console.log(`Header.js: Aktuálne triedy odkazov - Auth: ${authLink.classList.contains('hidden') ? 'hidden' : 'visible'} Profile: ${profileLink.classList.contains('hidden') ? 'hidden' : 'visible'} Logout: ${logoutButton.classList.contains('hidden') ? 'hidden' : 'visible'} Register: ${registerLink.classList.contains('hidden') ? 'hidden' : 'visible'}`);
}

// Poslucháč zmien stavu autentifikácie
if (authHeader) {
    authHeader.onAuthStateChanged(user => {
        currentHeaderUser = user;
        console.log("Header.js: onAuthStateChanged - Používateľ:", user ? user.uid : "null", "AuthStateInitialized:", true);
        // Aktualizujeme odkazy hneď po zmene stavu autentifikácie
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    });
} else {
    console.error("Header.js: Auth inštancia nie je dostupná pre onAuthStateChanged.");
    updateHeaderLinks(null, false); // Ak auth nie je k dispozícii, predvolene skryjeme prihlásené odkazy
}

// Poslucháč zmien nastavení registrácie
if (dbHeader) {
    const settingsDocRef = dbHeader.collection('settings').doc('registration');
    settingsDocRef.onSnapshot(docSnapshot => {
        let regStart = null;
        let regEnd = null;

        if (docSnapshot.exists) {
            const data = docSnapshot.data();
            regStart = data.registrationStartDate ? data.registrationStartDate.toDate() : null;
            regEnd = data.registrationEndDate ? data.registrationEndDate.toDate() : null;

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
        console.log(`Header.js: Nastavenia registrácie načítané. isRegistrationOpenStatus: ${currentIsRegistrationOpenStatus}`);
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    }, error => {
        console.error("Chyba pri načítaní nastavení registrácie pre hlavičku:", error);
        currentIsRegistrationOpenStatus = false;
        updateHeaderLinks(currentHeaderUser, currentIsRegistrationOpenStatus);
    });
} else {
    console.error("Header.js: Firestore inštancia nie je dostupná pre načítanie nastavení.");
    updateHeaderLinks(currentHeaderUser, false); // Ak db nie je k dispozícii, predvolene zatvoríme registráciu
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
