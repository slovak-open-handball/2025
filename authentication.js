// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false;
window.globalUserProfileData = null;
window.auth = null;
window.db = null;
window.showGlobalNotification = null;

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Túto webovú stránku nie je možné zobraziť.';
    errorMessageDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: red;
        font-size: 2em;
        font-weight: bold;
        text-align: center;
        z-index: 9999;
        font-family: 'Inter', sans-serif;
    `;
    document.body.appendChild(errorMessageDiv);
    throw new Error('Page cannot be displayed in an iframe.');
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Funkcia pre inicializáciu Firebase
const initFirebase = async () => {
    try {
        const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
        let firebaseConfig = JSON.parse(firebaseConfigString);

        if (!firebaseConfig.projectId) {
            console.warn("AuthManager: 'projectId' nie je poskytnuté v __firebase_config. Používa sa pevne zadaná konfigurácia.");
            firebaseConfig = {
                apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
                authDomain: "soh2025-2s0o2h5.firebaseapp.com",
                projectId: "soh2025-2s0o2h5",
                storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
                messagingSenderId: "572988314768",
                appId: "1:572988314768:web:781e27eb035179fe34b415"
            };
        }

        const app = initializeApp(firebaseConfig);
        window.db = getFirestore(app);
        window.auth = getAuth(app);
        
        // Dôležitá zmena: Odstránili sme volanie signInAnonymously() a signInWithCustomToken().
        // Aplikácia sa teraz spustí v stave odhláseného používateľa a na autentifikáciu
        // čaká až vtedy, keď ju vyvolá iný kód (napríklad prihlasovací formulár).
        
        console.log("AuthManager: Firebase inicializované. Automatické prihlásenie bolo vynechané.");
        return app;
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
        return null;
    }
};

// Pomocná funkcia pre autorizáciu prístupu k stránkam
const checkPageAuthorization = (userData, currentPath) => {
    // Definícia prístupových pravidiel pre jednotlivé stránky
    const pageAccessRules = {
      'index.html': { role: 'public', approved: true },
      'login.html': { role: 'public', approved: true },
      'account.html': { role: 'public', approved: true },
      'admin-register.html': { role: 'public', approved: true },
      'logged-in-users.html': { role: 'admin', approved: true },
      'logged-in-tournament-settings.html': { role: 'admin', approved: true },
      'logged-in-add-categories.html': { role: 'admin', approved: true },
      'logged-in-all-registrations.html': { role: 'admin', approved: true },
      'logged-in-my-data.html': { role: 'user', approved: true },
      'logged-in-registration.html': { role: 'user', approved: true },
    };

    const rules = pageAccessRules[currentPath.split('/').pop()] || { role: 'public', approved: true };
    const userRole = userData?.role;

    if (rules.role === 'admin' && userRole !== 'admin') {
      return false;
    }
    if (rules.role === 'user' && !userRole) {
      return false;
    }

    return true;
};

// Vytvorenie a odoslanie vlastnej udalosti
const dispatchGlobalStateChanged = () => {
    window.dispatchEvent(new CustomEvent('globalStateChanged'));
};


// Dôležité: Vykonáva sa raz po načítaní DOM
window.addEventListener('DOMContentLoaded', async () => {
    // Inicializácia Firebase
    const firebaseApp = await initFirebase();

    // Nastavíme listener len ak sa Firebase úspešne inicializovalo
    if (firebaseApp) {
        onAuthStateChanged(window.auth, (user) => {
            window.isGlobalAuthReady = true;
            if (user) {
                console.log("AuthManager: Používateľ prihlásený, načítavam profil.");
                const userDocRef = doc(window.db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');

                // onSnapshot pre real-time aktualizácie profilu
                const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        window.globalUserProfileData = { id: docSnap.id, ...docSnap.data(), isLoggedIn: true };
                        console.log("AuthManager: Načítaný profil používateľa:", window.globalUserProfileData);
                    } else {
                        window.globalUserProfileData = { isLoggedIn: true, id: user.uid }; // Anonymný používateľ alebo bez profilu
                        console.log("AuthManager: Žiadny profil používateľa nenájdený, nastavený anonymný profil.");
                    }

                    // Upozorníme ostatné skripty na zmenu stavu
                    dispatchGlobalStateChanged();

                    // Kontrola autorizácie stránky po načítaní profilu
                    if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                        console.warn("AuthManager: Používateľ nemá oprávnenie pre túto stránku. Presmerovanie na domovskú stránku.");
                        window.location.href = 'index.html';
                    }
                }, (error) => {
                    console.error("AuthManager: Chyba pri načítaní profilu:", error);
                    window.globalUserProfileData = { isLoggedIn: true }; // Pokusíme sa aspoň nastaviť, že je prihlásený
                    dispatchGlobalStateChanged();
                });

                // Čistenie pri odhlásení
                return () => unsubscribe();
            } else {
                console.log("AuthManager: Používateľ odhlásený.");
                window.globalUserProfileData = null;

                // Upozorníme ostatné skripty na zmenu stavu
                dispatchGlobalStateChanged();

                // Kontrola autorizácie stránky po odhlásení
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    window.location.href = 'index.html';
                }
            }
        });

        console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
    } else {
        // Ak sa Firebase nenačítalo, nastavíme globálny stav na ready
        // a odosleeme udalosť, aby sa UI aktualizovalo (napr. zostane zobrazený len odkaz na prihlásenie)
        window.isGlobalAuthReady = true;
        dispatchGlobalStateChanged();
        console.error("AuthManager: Listener pre zmeny stavu autentifikácie nebol nastavený kvôli chybe inicializácie Firebase.");
    }
});
