// header.js
// Tento skript dynamicky aktualizuje navigačnú lištu na základe stavu prihlásenia používateľa.

// Používame IIFE (Immediately Invoked Function Expression), aby sme zabránili kolíziám globálnych premenných,
// ak by sa tento skript neúmyselne načítal viackrát.
(function() {
    // Globálne premenné pre Firebase konfiguráciu a ID aplikácie
    // Predpokladá sa, že tieto premenné sú definované v prostredí Canvas.
    // Používame 'let' namiesto 'const' pre prípad, že by boli deklarované inde, hoci ideálne by mali byť len raz.
    let appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    let firebaseConfig;
    try {
        // Pokúsime sa parsovať firebaseConfig. Ak je __firebase_config prázdny alebo neplatný JSON,
        // nastavíme firebaseConfig na prázdny objekt.
        firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        // Ak firebaseConfig neobsahuje apiKey, je to problém
        if (!firebaseConfig.apiKey) {
            console.error("Firebase konfigurácia neobsahuje apiKey. Skontrolujte __firebase_config.");
        }
    } catch (e) {
        console.error("Chyba pri parsovaní __firebase_config:", e);
        firebaseConfig = {}; // Nastavíme prázdny objekt, ak je parsovanie neúspešné
    }
    let initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // Inicializácia Firebase aplikácie
    let app;
    let auth;
    let db;

    // Kontrola, či už Firebase nie je inicializovaný
    // Ak firebase.apps.length je 0, znamená to, že žiadna Firebase aplikácia nebola inicializovaná.
    if (!firebase.apps.length) {
        try {
            app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth(app);
            db = firebase.firestore(app);
            console.log("Firebase inicializovaný v header.js");

            // Prihlásenie s vlastným tokenom alebo anonymne
            const signIn = async () => {
                try {
                    if (initialAuthToken) {
                        await auth.signInWithCustomToken(initialAuthToken);
                        console.log("Prihlásenie s vlastným tokenom v header.js.");
                    } else {
                        await auth.signInAnonymously();
                        console.log("Prihlásenie anonymne v header.js.");
                    }
                } catch (error) {
                    console.error("Chyba pri prihlásení v header.js:", error);
                    // Tu by ste mohli zobraziť používateľovi správu o chybe pri prihlásení
                }
            };
            signIn();

        } catch (error) {
            console.error("Chyba pri inicializácii Firebase v header.js:", error);
            // Táto chyba bude pravdepodobne obsahovať 'auth/invalid-api-key'
        }
    } else {
        // Ak je Firebase už inicializovaný, použijeme existujúcu inštanciu
        app = firebase.app();
        auth = firebase.auth(app);
        db = firebase.firestore(app);
        console.log("Firebase už bol inicializovaný, použil sa existujúci v header.js.");
    }

    // Funkcia na aktualizáciu viditeľnosti navigačných prvkov
    const updateNavVisibility = (user) => {
        const loginNavItem = document.getElementById('login-nav-item');
        const myZoneNavItem = document.getElementById('my-zone-nav-item');
        const logoutNavItem = document.getElementById('logout-nav-item');

        if (loginNavItem && myZoneNavItem && logoutNavItem) { // Kontrolujeme len hlavné li elementy
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
            console.warn("Chyba: Niektoré navigačné prvky neboli nájdené v DOM. Uistite sa, že header.html je načítaný.");
        }
    };

    // Poslucháč zmien stavu autentifikácie
    // Uistite sa, že auth objekt existuje pred nastavením poslucháča
    if (auth) {
        auth.onAuthStateChanged((user) => {
            updateNavVisibility(user);
        });
    } else {
        console.error("Firebase Auth nie je inicializovaný. Nemôžem nastaviť poslucháča stavu autentifikácie.");
    }

    // Pridanie poslucháča udalosti pre tlačidlo Odhlásenie
    // Používame DOMContentLoaded, aby sme sa uistili, že tlačidlo je k dispozícii
    document.addEventListener('DOMContentLoaded', () => {
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton && auth) { // Skontrolujeme aj auth, aby sme sa uistili, že je k dispozícii pre signOut
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
        } else if (logoutButton && !auth) {
            console.warn("Tlačidlo odhlásenia nájdené, ale Firebase Auth nie je inicializovaný. Odhlasovanie nebude fungovať.");
        }
    });

})(); // Koniec IIFE
