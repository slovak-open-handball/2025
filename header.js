// header.js
// Tento skript dynamicky aktualizuje navigačnú lištu na základe stavu prihlásenia používateľa.
// Je tiež zodpovedný za JEDINÚ inicializáciu Firebase v aplikácii.

// Dôležité: Predpokladá sa, že globálne premenné `appId`, `firebaseConfig` a `initialAuthToken`
// sú definované v HTML súbore PRED načítaním tohto skriptu.

(function() {
    // Kontrola, či sú globálne premenné k dispozícii.
    if (typeof appId === 'undefined' || typeof firebaseConfig === 'undefined' || typeof initialAuthToken === 'undefined') {
        console.error("Chyba: Globálne premenné appId, firebaseConfig alebo initialAuthToken nie sú definované. Uistite sa, že sú definované v HTML pred načítaním header.js.");
        // Ak nie sú definované, nastavíme ich na bezpečné, ale nefunkčné predvolené hodnoty
        window.appId = window.appId || 'default-app-id';
        window.firebaseConfig = window.firebaseConfig || {};
        window.initialAuthToken = window.initialAuthToken || null;
    }

    // Inicializácia Firebase aplikácie
    let app;
    let auth;
    let db;

    // Kontrola, či už Firebase nie je inicializovaný.
    if (!firebase.apps.length) {
        try {
            app = firebase.initializeApp(firebaseConfig);
            auth = firebase.auth(app);
            db = firebase.firestore(app);
            console.log("Firebase inicializovaný v header.js.");

            // Prihlásenie s vlastným tokenom alebo anonymne
            const signIn = async () => {
                try {
                    if (initialAuthToken) {
                        await auth.signInWithCustomToken(initialAuthToken);
                        console.log("Používateľ prihlásený s vlastným tokenom v header.js.");
                    } else {
                        await auth.signInAnonymously();
                        console.log("Používateľ prihlásený anonymne v header.js.");
                    }
                } catch (error) {
                    console.error("Chyba pri prihlásení v header.js:", error);
                }
            };
            signIn();

        } catch (error) {
            console.error("Chyba pri inicializácii Firebase v header.js:", error);
        }
    } else {
        // Ak je Firebase už inicializovaný, použijeme existujúcu inštanciu.
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

        if (loginNavItem && myZoneNavItem && logoutNavItem) {
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
            console.warn("Chyba: Niektoré navigačné prvky neboli nájdené v DOM. Uistite sa, že header.html je načítaný správne.");
        }
    };

    // Poslucháč zmien stavu autentifikácie
    if (auth) {
        auth.onAuthStateChanged((user) => {
            console.log("onAuthStateChanged triggered. Používateľ:", user ? user.uid : "null (odhlásený)");
            updateNavVisibility(user);
        });
    } else {
        console.error("Firebase Auth nie je inicializovaný. Nemôžem nastaviť poslucháča stavu autentifikácie.");
    }

    // Pridanie poslucháča udalosti pre tlačidlo Odhlásenie
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOMContentLoaded fired. Pokúšam sa pripojiť poslucháča odhlásenia.");
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async (event) => {
                event.preventDefault(); // Zabrániť predvolenému správaniu tlačidla
                console.log("Tlačidlo odhlásenia kliknuté.");
                if (auth) {
                    try {
                        console.log("Pokúšam sa odhlásiť používateľa...");
                        await auth.signOut(); // Vykoná odhlásenie
                        console.log("Používateľ odhlásený úspešne.");
                        // Po úspešnom odhlásení presmerujeme po malej chvíli,
                        // aby sa UI stihlo aktualizovať cez onAuthStateChanged.
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 100); // 100ms oneskorenie
                    } catch (error) {
                        console.error("Chyba pri odhlasovaní:", error);
                    }
                } else {
                    console.error("Firebase Auth nie je k dispozícii pre odhlásenie.");
                }
            });
        } else {
            console.warn("Tlačidlo odhlásenia (#logout-button) nebolo nájdené v DOM.");
        }
    });

})(); // Koniec IIFE
