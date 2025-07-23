// header.js
// Tento skript sa stará o načítanie obsahu header.html a správu prihlásenia/odhlásenia.

// Funkcia na zobrazenie globálnej správy (namiesto alert())
function showGlobalMessage(message, type = 'info') {
    const messageBox = document.getElementById('global-message-box');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`; // Nastaví triedu pre štýl (success, error, info)
        messageBox.classList.remove('hidden'); // Zobrazí správu
        setTimeout(() => {
            messageBox.classList.add('hidden'); // Skryje správu po 5 sekundách
        }, 5000);
    }
}

// Inicializácia Firebase a Firestore
let app;
let auth;
let db;
let userId = null; // ID používateľa
let isRegistrationOpen = false; // Stav registrácie

// Funkcia na inicializáciu Firebase
async function initializeFirebase() {
    try {
        // Kontrola, či sú globálne premenné dostupné
        if (typeof window.firebaseConfig === 'undefined' || typeof window.appId === 'undefined') {
            console.error("Firebase config alebo App ID nie sú definované globálne.");
            showGlobalMessage("Chyba: Konfigurácia aplikácie chýba.", "error");
            return;
        }

        app = firebase.initializeApp(window.firebaseConfig);
        auth = firebase.auth(); // Používa compat verziu
        db = firebase.firestore(); // Používa compat verziu

        console.log("Firebase inicializovaný.");

        // Prihlásenie používateľa pomocou custom tokenu alebo anonymne
        if (window.initialAuthToken) {
            await auth.signInWithCustomToken(window.initialAuthToken);
            console.log("Prihlásený pomocou custom tokenu.");
        } else {
            await auth.signInAnonymously();
            console.log("Prihlásený anonymne.");
        }

        // Listener pre zmeny stavu autentifikácie
        auth.onAuthStateChanged(user => {
            if (user) {
                userId = user.uid;
                console.log("Používateľ prihlásený:", userId);
                updateNavigation(true); // Aktualizovať navigáciu pre prihláseného používateľa
                showGlobalMessage(`Vitajte, používateľ ${userId}!`, "success");
            } else {
                userId = null;
                console.log("Používateľ odhlásený.");
                updateNavigation(false); // Aktualizovať navigáciu pre odhláseného používateľa
                showGlobalMessage("Boli ste odhlásení.", "info");
            }
        });

        // Načítanie stavu registrácie po inicializácii Firebase
        await fetchRegistrationStatus();

    } catch (error) {
        console.error("Chyba pri inicializácii Firebase alebo prihlásení:", error);
        showGlobalMessage(`Chyba pri inicializácii: ${error.message}`, "error");
    }
}

// Funkcia na načítanie stavu registrácie z Firestore
async function fetchRegistrationStatus() {
    if (!db) {
        console.error("Firestore nie je inicializovaný.");
        return;
    }
    try {
        // Cesta k dokumentu s nastaveniami registrácie
        // Používame __app_id pre dynamickú cestu
        const docRef = db.collection(`artifacts/${window.appId}/public/data/app_settings`).doc('registration_status');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            isRegistrationOpen = docSnap.data().isOpen || false;
            console.log("Stav registrácie načítaný:", isRegistrationOpen);
        } else {
            console.log("Dokument 'registration_status' neexistuje. Predvolený stav: zatvorená.");
            isRegistrationOpen = false;
        }
        // Aktualizovať navigáciu na základe novo načítaného stavu registrácie
        // Používame auth.currentUser?.uid pre kontrolu, či je používateľ prihlásený
        updateNavigation(auth.currentUser !== null);

    } catch (error) {
        console.error("Chyba pri načítaní stavu registrácie z Firestore:", error);
        showGlobalMessage(`Chyba pri načítaní stavu registrácie: ${error.message}`, "error");
        isRegistrationOpen = false; // V prípade chyby predpokladáme, že registrácia je zatvorená
        updateNavigation(auth.currentUser !== null); // Aj tak aktualizovať navigáciu
    }
}


// Funkcia na aktualizáciu navigačného menu na základe stavu prihlásenia a stavu registrácie
function updateNavigation(isLoggedIn) {
    const myZoneNavItem = document.getElementById('my-zone-nav-item');
    const loginNavItem = document.getElementById('login-nav-item');
    const registrationNavItem = document.getElementById('registration-nav-item');
    const logoutNavItem = document.getElementById('logout-nav-item');
    const logoutButton = document.getElementById('logout-button');
    const tournamentRegistrationTextItem = document.getElementById('tournament-registration-text-item');

    // "Moja zóna" sa zobrazuje len prihláseným používateľom
    if (myZoneNavItem) {
        myZoneNavItem.classList.toggle('hidden', !isLoggedIn);
    }
    // "Prihlásenie" sa zobrazuje len odhláseným používateľom
    if (loginNavItem) {
        loginNavItem.classList.toggle('hidden', isLoggedIn);
    }
    // "Registrácia" sa zobrazuje len ak je otvorená a používateľ nie je prihlásený
    if (registrationNavItem) {
        registrationNavItem.classList.toggle('hidden', !(isRegistrationOpen && !isLoggedIn));
    }
    // "Odhlásenie" sa zobrazuje len prihláseným používateľom
    if (logoutNavItem) {
        logoutNavItem.classList.toggle('hidden', !isLoggedIn);
    }
    // "Registrácia na turnaj" text sa zobrazuje len ak je otvorená registrácia
    if (tournamentRegistrationTextItem) {
        tournamentRegistrationTextItem.classList.toggle('hidden', !isRegistrationOpen);
    }


    if (logoutButton) {
        logoutButton.onclick = async () => {
            try {
                await auth.signOut();
                console.log("Používateľ sa úspešne odhlásil.");
                // Presmerovanie na domovskú stránku po odhlásení
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Chyba pri odhlásení:", error);
                showGlobalMessage(`Chyba pri odhlásení: ${error.message}`, "error");
            }
        };
    }
}

// Funkcia na načítanie obsahu header.html
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        if (!response.ok) {
            throw new Error(`HTTP chyba! Status: ${response.status}`);
        }
        const headerHtml = await response.text();
        const headerContainer = document.getElementById('main-header');
        if (headerContainer) {
            headerContainer.innerHTML = headerHtml;
            console.log("header.html úspešne načítaný.");
            // Po načítaní hlavičky inicializujeme Firebase a nastavíme listenery
            await initializeFirebase(); // Používame await, aby sa zabezpečila inicializácia pred aktualizáciou UI
        } else {
            console.error("Kontajner s ID 'main-header' nebol nájdený.");
            showGlobalMessage("Chyba: Kontajner pre hlavičku chýba.", "error");
        }
    } catch (error) {
        console.error("Chyba pri načítaní header.html:", error);
        showGlobalMessage(`Chyba pri načítaní hlavičky: ${error.message}`, "error");
    }
}

// Spustiť načítanie hlavičky, keď je DOM plne načítaný
document.addEventListener('DOMContentLoaded', loadHeader);

// Exportujte premenné a funkcie, ak ich potrebujete v iných skriptoch
// Sprístupníme ich globálne pre index.js
window.auth = auth;
window.db = db;
window.getUserId = () => userId; // Funkcia na získanie ID používateľa
window.showGlobalMessage = showGlobalMessage; // Sprístupní funkciu pre globálne správy
window.isRegistrationOpen = () => isRegistrationOpen; // Sprístupní stav registrácie
