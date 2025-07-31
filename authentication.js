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
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Táto aplikácia nemôže byť zobrazená v rámčeku (iframe).';
    errorMessageDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #fff; display: flex; justify-content: center; align-items: center; color: #000; font-family: sans-serif; font-size: 20px; text-align: center;';
    document.body.appendChild(errorMessageDiv);
}

// Funkcia na kontrolu oprávnení na základe cesty
const checkPageAuthorization = (userProfile, path) => {
    // Vytvorenie whitelistu pre verejné stránky
    const publicPages = ['/', '/index.html', '/login.html', '/about.html', '/contact.html'];
    
    // Ak je používateľ odhlásený, povoliť prístup len na verejné stránky
    if (!userProfile) {
        return publicPages.includes(path) || publicPages.includes(path.split('/').pop());
    }
    
    // Ak je používateľ prihlásený, povoliť prístup na všetky stránky okrem login/registrácie pre neprihlásených
    const loggedInOnlyPages = ['/logged-in-my-data.html', '/logged-in-registration.html'];
    if (loggedInOnlyPages.includes(path) || loggedInOnlyPages.includes(path.split('/').pop())) {
        return true;
    }
    
    // Odmietnuť prístup na prihlasovacie stránky, ak je používateľ už prihlásený
    const authPages = ['/login.html'];
    if (authPages.includes(path) || authPages.includes(path.split('/').pop())) {
        return false;
    }

    return true;
};

// Vytvorenie a inicializácia Firebase aplikácie
const setupFirebase = () => {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (Object.keys(firebaseConfig).length === 0) {
            console.error("AuthManager: Firebase config nie je definovaný.");
            return;
        }

        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase služby inicializované.");
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Spracovanie autentifikácie a načítania profilu používateľa
const handleAuthState = async () => {
    const auth = window.auth;
    const db = window.db;

    if (!auth || !db) {
        console.error("AuthManager: Firebase služby nie sú inicializované.");
        return;
    }

    // Nastavíme listener na zmeny stavu autentifikácie
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true; // Sme pripravení po prvej kontrole stavu
        
        let unsubscribe = () => {};

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, načítavam profil.");
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile`, user.uid);

            unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Načítaný profil používateľa:", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Žiadny profil používateľa nenájdený.");
                    window.globalUserProfileData = null;
                }
                
                // Kontrola autorizácie stránky po načítaní profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Používateľ nemá oprávnenie pre túto stránku. Presmerovanie na domovskú stránku.");
                    window.location.href = 'index.html';
                }
                
                // Ak existuje globálna funkcia na inicializáciu aplikácie (napr. z logged-in-my-data.js), zavoláme ju.
                if (window.initMyDataApp) {
                    window.initMyDataApp();
                }
                
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                // Kontrola autorizácie aj pri chybe načítania profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    window.location.href = 'index.html';
                }
            });

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                window.location.href = 'index.html';
            }
            
            // Ak sa používateľ odhlási, a je funkcia na inicializáciu, zavoláme ju tiež,
            // aby sa aplikácia správne vyčistila a zobrazila stav "nie je prihlásený".
            if (window.initMyDataApp) {
                 window.initMyDataApp();
            }
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};


// Spustenie autentifikácie po načítaní DOM
window.addEventListener('DOMContentLoaded', async () => {
    // Inicializácia Firebase
    setupFirebase();
    // Spustenie logiky pre autentifikáciu
    handleAuthState();

    const auth = window.auth;
    if (!auth) {
        console.error("AuthManager: Authentication služby nie sú dostupné.");
        return;
    }
    
    // Získanie tokenu a prihlásenie
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("AuthManager: Prihlásenie pomocou custom tokenu bolo úspešné.");
        } else {
            await signInAnonymously(auth);
            console.log("AuthManager: Prihlásenie ako anonymný používateľ bolo úspešné.");
        }
    } catch (error) {
        console.error("AuthManager: Chyba pri prihlasovaní:", error);
    }
});
