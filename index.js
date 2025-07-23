// index.js
// Tento skript sa stará o inicializáciu Firebase, správu stavu prihlásenia,
// načítanie stavu registrácie z databázy a dynamické zobrazenie tlačidiel
// na hlavnej stránke.

// Globálna funkcia pre zobrazovanie správ používateľovi
function showGlobalMessage(message, type = 'info') {
    const messageBox = document.getElementById('global-message-box');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`; // Nastaví triedu pre štýlovanie (info, success, error)
        messageBox.classList.remove('hidden'); // Zobrazí správu
        // Skryje správu po 5 sekundách
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 5000);
    } else {
        console.warn("Element 'global-message-box' nebol nájdený.");
    }
}

// Globálne premenné pre Firebase inštancie a stavy
let auth;
let db;
let isLoggedIn = false;
let isRegistrationOpen = false;
let currentUserId = null;

// Funkcia pre inicializáciu hlavnej logiky stránky
async function initializeMainPageLogic() {
    console.log("Inicializujem hlavnú logiku stránky...");

    try {
        // Inicializácia Firebase aplikácie
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            showGlobalMessage("Chyba: Firebase SDK nie je načítaný. Skontrolujte index.html.", "error");
            return;
        }

        // Ak už je Firebase inicializovaný (napr. z header.js), použijeme existujúce inštancie
        // Inak inicializujeme tu
        if (!window.firebaseApp) {
            window.firebaseApp = firebase.initializeApp(window.firebaseConfig);
            console.log("Firebase aplikácia inicializovaná v index.js.");
        }
        auth = firebase.auth();
        db = firebase.firestore();

        // Prihlásenie používateľa (anonymne alebo custom tokenom)
        if (window.initialAuthToken) {
            await auth.signInWithCustomToken(window.initialAuthToken);
            console.log("Prihlásený pomocou custom tokenu.");
        } else {
            await auth.signInAnonymously();
            console.log("Prihlásený anonymne.");
        }

        // Listener pre zmeny stavu autentifikácie
        auth.onAuthStateChanged(user => {
            isLoggedIn = !!user;
            currentUserId = user ? user.uid : null;
            console.log("Stav prihlásenia aktualizovaný:", isLoggedIn, "UID:", currentUserId);
            renderMainPageButtons(); // Prekreslí tlačidlá po zmene stavu
        });

        // Listener pre stav registrácie z Firestore
        const appId = window.appId; // Používame globálne __app_id
        const registrationStatusRef = db.collection(`artifacts/${appId}/public/data/app_settings`).doc('registration_status');

        registrationStatusRef.onSnapshot(docSnap => {
            if (docSnap.exists) {
                isRegistrationOpen = docSnap.data().isOpen || false;
                console.log("Stav registrácie načítaný z Firestore:", isRegistrationOpen);
            } else {
                isRegistrationOpen = false; // Predvolené, ak dokument neexistuje
                console.log("Dokument 'registration_status' neexistuje. Registrácia zatvorená.");
            }
            renderMainPageButtons(); // Prekreslí tlačidlá po zmene stavu
        }, error => {
            console.error("Chyba pri načítaní stavu registrácie:", error);
            showGlobalMessage(`Chyba pri načítaní stavu registrácie: ${error.message}`, "error");
            isRegistrationOpen = false; // V prípade chyby predpokladáme, že je zatvorená
            renderMainPageButtons();
        });

        // Po úspešnej inicializácii vykreslíme tlačidlá prvýkrát
        renderMainPageButtons();

    } catch (error) {
        console.error("Chyba pri inicializácii Firebase v index.js:", error);
        showGlobalMessage(`Chyba pri inicializácii aplikácie: ${error.message}`, "error");
    }
}

// Funkcia pre dynamické vykreslenie tlačidiel
function renderMainPageButtons() {
    const mainContentButtonsContainer = document.getElementById('main-content-buttons');
    if (!mainContentButtonsContainer) {
        console.error("Kontajner 'main-content-buttons' nebol nájdený.");
        return;
    }

    // Vyčistíme kontajner pred pridaním nových tlačidiel
    mainContentButtonsContainer.innerHTML = '';

    // Tlačidlo "Moja zóna" (pre prihlásených používateľov)
    if (isLoggedIn) {
        const myZoneButton = document.createElement('a');
        myZoneButton.href = 'my-zone.html';
        myZoneButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105';
        myZoneButton.textContent = 'Moja zóna';
        mainContentButtonsContainer.appendChild(myZoneButton);
    } else {
        // Tlačidlo "Prihlásenie" (pre odhlásených používateľov)
        const loginButton = document.createElement('a');
        loginButton.href = 'login.html';
        loginButton.className = 'bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105';
        loginButton.textContent = 'Prihlásenie';
        mainContentButtonsContainer.appendChild(loginButton);

        // Tlačidlo "Registrácia" (pre odhlásených používateľov, ak je registrácia otvorená)
        if (isRegistrationOpen) {
            const registrationButton = document.createElement('a');
            registrationButton.href = 'registration.html';
            registrationButton.className = 'bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105';
            registrationButton.textContent = 'Registrácia';
            mainContentButtonsContainer.appendChild(registrationButton);
        }
    }
}

// Export funkcie pre inicializáciu, aby ju mohol volať index.html
window.initializeMainPageLogic = initializeMainPageLogic;
// Export globálnych premenných/funkcií, ak ich potrebujú iné skripty (napr. header.js)
window.auth = auth;
window.db = db;
window.isLoggedIn = () => isLoggedIn;
window.getUserId = () => currentUserId;
window.isRegistrationOpen = () => isRegistrationOpen; // Export funkcie pre získanie stavu registrácie
window.showGlobalMessage = showGlobalMessage;
