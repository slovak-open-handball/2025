// header.js
// Tento skript dynamicky aktualizuje navigačnú lištu na základe stavu prihlásenia používateľa.

// Globálne premenné pre Firebase konfiguráciu a ID aplikácie
// Predpokladá sa, že tieto premenné sú definované v prostredí Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase aplikácie
let app;
let auth;
let db;

try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app(); // Použije existujúcu predvolenú aplikáciu
    }
    auth = firebase.auth(app);
    db = firebase.firestore(app);
    console.log("Firebase inicializovaný v header.js");

    // Prihlásenie s vlastným tokenom alebo anonymne
    const signIn = async () => {
        try {
            if (initialAuthToken) {
                await auth.signInWithCustomToken(initialAuthToken);
                console.log("Prihlásenie s vlastným tokenom v header.js");
            } else {
                await auth.signInAnonymously();
                console.log("Prihlásenie anonymne v header.js");
            }
        } catch (error) {
            console.error("Chyba pri prihlásení v header.js:", error);
            // Tu by ste mohli zobraziť používateľovi správu o chybe pri prihlásení
        }
    };
    signIn();

} catch (error) {
    console.error("Chyba pri inicializácii Firebase v header.js:", error);
}

// Funkcia na aktualizáciu viditeľnosti navigačných prvkov
const updateNavVisibility = (user) => {
    const loginNavItem = document.getElementById('login-nav-item');
    const myZoneNavItem = document.getElementById('my-zone-nav-item');
    const logoutNavItem = document.getElementById('logout-nav-item');
    const logoutButton = document.getElementById('logout-button');

    if (loginNavItem && myZoneNavItem && logoutNavItem && logoutButton) {
        if (user) {
            // Používateľ je prihlásený
            loginNavItem.classList.add('hidden'); // Skryť Prihlásenie
            myZoneNavItem.classList.remove('hidden'); // Zobraziť Moja Zóna
            logoutNavItem.classList.remove('hidden'); // Zobraziť Odhlásenie
            console.log("Navigácia aktualizovaná: Prihlásený používateľ.");
        } else {
            // Používateľ NIE JE prihlásený
            loginNavItem.classList.remove('hidden'); // Zobraziť Prihlásenie
            myZoneNavItem.classList.add('hidden'); // Skryť Moja Zóna
            logoutNavItem.classList.add('hidden'); // Skryť Odhlásenie
            console.log("Navigácia aktualizovaná: Odhlásený používateľ.");
        }
    } else {
        console.warn("Chyba: Niektoré navigačné prvky neboli nájdené v DOM.");
    }
};

// Poslucháč zmien stavu autentifikácie
if (auth) {
    auth.onAuthStateChanged((user) => {
        updateNavVisibility(user);
    });
} else {
    console.error("Firebase Auth nie je inicializovaný. Nemôžem nastaviť poslucháča stavu autentifikácie.");
}

// Pridanie poslucháča udalosti pre tlačidlo Odhlásenie
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await auth.signOut();
                console.log("Používateľ odhlásený.");
                // Voliteľné: presmerovanie na domovskú stránku alebo prihlasovaciu stránku
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Chyba pri odhlasovaní:", error);
                // Tu by ste mohli zobraziť používateľovi správu o chybe
            }
        });
    }
});
