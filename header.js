// header.js
// Tento skript inicializuje Firebase pre hlavičku a spravuje zobrazenie navigačných odkazov
// na základe stavu prihlásenia používateľa.

// Získanie referencií na Firebase SDKs
// Tieto by mali byť už načítané v HTML súbore pred týmto skriptom
const firebaseApp = typeof firebase !== 'undefined' ? firebase : null;
const getAuth = typeof firebase.auth !== 'undefined' ? firebase.auth().getAuth : null;
const signOut = typeof firebase.auth !== 'undefined' ? firebase.auth().signOut : null;
const onAuthStateChanged = typeof firebase.auth !== 'undefined' ? firebase.auth().onAuthStateChanged : null;

// Skontrolujeme, či sú globálne premenné definované
if (typeof __firebase_config === 'undefined' || typeof __firebase_app_name === 'undefined') {
    console.error("Chyba: Globálne premenné __firebase_config alebo __firebase_app_name nie sú definované.");
    // Zobraziť chybu používateľovi alebo zakázať funkčnosť hlavičky
} else if (!firebaseApp || !getAuth || !signOut || !onAuthStateChanged) {
    console.error("Chyba: Firebase SDKs nie sú správne načítané v header.js.");
    // Zobraziť chybu používateľovi
} else {
    // Inicializácia Firebase aplikácie pre hlavičku
    // Používame pomenovanú aplikáciu, aby sa predišlo konfliktom s predvolenou aplikáciou na iných stránkach
    let headerApp;
    try {
        // Skontrolujeme, či už aplikácia s týmto názvom existuje
        headerApp = firebaseApp.apps.find(app => app.name === __firebase_app_name);
        if (!headerApp) {
            headerApp = firebaseApp.initializeApp(JSON.parse(__firebase_config), __firebase_app_name);
            console.log(`Firebase aplikácia '${__firebase_app_name}' inicializovaná pre hlavičku.`);
        } else {
            console.log(`Používa sa existujúca Firebase aplikácia '${__firebase_app_name}' pre hlavičku.`);
        }
    } catch (e) {
        console.error(`Chyba pri inicializácii Firebase aplikácie '${__firebase_app_name}' pre hlavičku:`, e);
        // Tu by ste mohli zobraziť chybu používateľovi
    }

    // Získanie inštancie autentifikácie pre hlavičku
    const auth = getAuth(headerApp);

    // Funkcia na aktualizáciu UI hlavičky
    function updateHeaderUI(user) {
        const loginNavItem = document.getElementById('login-nav-item');
        const myZoneNavItem = document.getElementById('my-zone-nav-item');
        const logoutNavItem = document.getElementById('logout-nav-item');
        const logoutButton = document.getElementById('logout-button');

        if (!loginNavItem || !myZoneNavItem || !logoutNavItem || !logoutButton) {
            console.warn("Chyba: Niektoré navigačné prvky hlavičky neboli nájdené v DOM.");
            return;
        }

        if (user) {
            // Používateľ je prihlásený
            loginNavItem.classList.add('hidden'); // Skryť "Prihlásenie"
            myZoneNavItem.classList.remove('hidden'); // Zobraziť "Moja Zóna"
            logoutNavItem.classList.remove('hidden'); // Zobraziť "Odhlásenie"
            console.log("Hlavička aktualizovaná: Používateľ prihlásený.");
        } else {
            // Používateľ nie je prihlásený
            loginNavItem.classList.remove('hidden'); // Zobraziť "Prihlásenie"
            myZoneNavItem.classList.add('hidden'); // Skryť "Moja Zóna"
            logoutNavItem.classList.add('hidden'); // Skryť "Odhlásenie"
            console.log("Hlavička aktualizovaná: Používateľ odhlásený.");
        }
    }

    // Poslucháč zmien stavu autentifikácie
    // Táto funkcia sa spustí vždy, keď sa zmení stav prihlásenia (prihlásenie, odhlásenie, inicializácia)
    onAuthStateChanged(auth, (user) => {
        updateHeaderUI(user);
    });

    // Pridanie poslucháča udalosti pre tlačidlo odhlásenia
    document.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'logout-button') {
            signOut(auth).then(() => {
                // Odhlásenie úspešné
                console.log("Používateľ úspešne odhlásený.");
                // Presmerovať na domovskú stránku alebo stránku prihlásenia
                window.location.href = 'index.html';
            }).catch((error) => {
                // Chyba pri odhlásení
                console.error("Chyba pri odhlásení:", error);
                // Tu by ste mohli zobraziť chybu používateľovi (napr. modálne okno)
            });
        }
    });
}
