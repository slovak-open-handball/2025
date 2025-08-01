// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5"
};

// Pomocná funkcia na inicializáciu Firebase a jej globálne sprístupnenie
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializovaný.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
        window.isGlobalAuthReady = true;
    }
};

// Funkcia na overenie autorizácie a presmerovanie
const checkPageAuthorization = (profileData, path) => {
    // Definuj povolené cesty pre rôzne roly
    const allowedPaths = {
        'admin': ['/index.html', '/logged-in-my-data.html', '/admin.html'],
        'user': ['/index.html', '/logged-in-my-data.html', '/logged-in-registration.html'],
        'hall': ['/index.html', '/logged-in-my-data.html', '/logged-in-hall.html'],
        'unauthenticated': ['/index.html', '/login.html', '/register.html']
    };

    let userRole = profileData ? profileData.type : 'unauthenticated';
    let currentPath = path.split('/').pop() || 'index.html';

    // Špeciálne prípady pre login.html a register.html pre autentifikovaných
    if (userRole !== 'unauthenticated' && (currentPath === 'login.html' || currentPath === 'register.html')) {
        console.warn('AuthManager: Prihlásený používateľ bol presmerovaný z prihlasovacej/registračnej stránky.');
        window.location.href = 'index.html';
        return false;
    }

    if (!allowedPaths[userRole] || !allowedPaths[userRole].includes(`/${currentPath}`)) {
        console.warn(`AuthManager: Používateľ s rolou '${userRole}' nemá prístup na stránku '${currentPath}'.`);
        window.location.href = 'index.html';
        return false;
    }

    console.log(`AuthManager: Autorizácia pre rolu '${userRole}' na stránke '${currentPath}' úspešná.`);
    return true;
};

// Hlavná funkcia, ktorá spracováva zmeny stavu autentifikácie
const handleAuthState = () => {
    onAuthStateChanged(window.auth, async (user) => {
        window.isGlobalAuthReady = true;
        let unsubscribeUserDoc = null;
        
        if (user) {
            console.log("AuthManager: Používateľ prihlásený.", user);
            const userDocRef = doc(window.db, "artifacts", typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', "users", user.uid);

            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = docSnap.data();
                    console.log("AuthManager: Dáta profilu používateľa načítané a aktualizované.");
                } else {
                    console.warn("AuthManager: Pre prihláseného používateľa neboli nájdené žiadne dáta profilu.");
                    window.globalUserProfileData = null;
                }
                
                // ODOSLANIE DÁT S CUSTOM EVENTOM
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));

                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                }
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                // Kontrola autorizácie aj pri chybe načítania profilu
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            });

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                // Prešiel som
            }
        }

        // Uisti sa, že sa listener odhlási, ak sa používateľ odhlási
        window.addEventListener('beforeunload', () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};


// Spustenie inicializácie po načítaní DOM
window.addEventListener('DOMContentLoaded', async () => {
    // Inicializácia Firebase
    setupFirebase();
    // Spustenie logiky pre autentifikáciu (ktorá teraz spúšťa listener)
    handleAuthState();
});
