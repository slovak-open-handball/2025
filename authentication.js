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
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
    // Získame názov súboru z cesty pre porovnanie
    const pageName = path.split('/').pop();

    // Whitelist verejných stránok, na ktoré má prístup každý
    const publicPages = ['index.html'];
    // Stránky pre neprihlásených používateľov (login)
    const authPages = ['login.html'];
    // Stránky pre prihlásených používateľov
    const loggedInOnlyPages = ['logged-in-my-data.html', 'logged-in-registration.html'];

    // Ak používateľ nie je prihlásený
    if (!userProfile) {
        // Ak sa pokúša o prístup na stránku pre prihlásených, presmerujeme ho na index
        if (loggedInOnlyPages.includes(pageName)) {
            console.warn("AuthManager: Neprihlásený používateľ nemá prístup. Presmerovanie na domovskú stránku.");
            window.location.href = 'index.html';
            return false;
        }
        // Inak je prístup na verejné stránky a login povolený
        return true;
    }
    // Ak je používateľ prihlásený
    else {
        // Ak sa pokúša o prístup na stránku login, presmerujeme ho na jeho profil
        if (authPages.includes(pageName)) {
            console.warn("AuthManager: Prihlásený používateľ nemá prístup na prihlasovaciu stránku. Presmerovanie na profil.");
            window.location.href = 'logged-in-my-data.html';
            return false;
        }
        // Inak má prístup na všetky stránky (vrátane indexu a stránok pre prihlásených)
        return true;
    }
};


// Vytvorenie a inicializácia Firebase aplikácie
const setupFirebase = () => {
    try {
        // Pevne definovaná konfigurácia Firebase podľa požiadavky používateľa
        const firebaseConfig = {
            apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
            authDomain: "soh2025-2s0o2h5.firebaseapp.com",
            projectId: "soh2025-2s0o2h5",
            storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
            messagingSenderId: "572988314768",
            appId: "1:572988314768:web:781e27eb035179fe34b415"
        };
        
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
    
    // Získanie tokenu z globálnej premennej
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

    // Nastavíme listener na zmeny stavu autentifikácie
    // Táto funkcia sa spustí okamžite s aktuálnym stavom a potom pri každej zmene
    onAuthStateChanged(auth, async (user) => {
        // Ak už prebehla prvá kontrola stavu, nič nerobíme (aby sa predišlo duplicitnému prihlasovaniu)
        if (window.isGlobalAuthReady) {
            return;
        }

        // Ak nie je používateľ prihlásený, pokúsime sa ho prihlásiť, len ak máme custom token
        if (!user && initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("AuthManager: Prihlásenie pomocou custom tokenu bolo úspešné.");
            } catch (error) {
                console.error("AuthManager: Chyba pri prihlasovaní s tokenom:", error);
                // Nastavíme isGlobalAuthReady aj pri chybe, aby sme sa vyhli zacykleniu
                window.isGlobalAuthReady = true; 
            }
        }
        
        // Nastavíme isGlobalAuthReady, aby sa tento blok kódu nespustil znova
        window.isGlobalAuthReady = true;

        // Teraz spracujeme načítanie profilu a autorizáciu
        if (auth.currentUser) {
            console.log("AuthManager: Používateľ prihlásený, načítavam profil.");
            const appId = "soh2025-2s0o2h5"; // Použijeme pevne definované app ID z konfigurácie
            const userDocRef = doc(db, `artifacts/${appId}/users/${auth.currentUser.uid}/profile`, auth.currentUser.uid);

            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Načítaný profil používateľa:", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Žiadny profil používateľa nenájdený.");
                    window.globalUserProfileData = null;
                }
                
                // Kontrola autorizácie stránky po načítaní profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                }
                
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                // Kontrola autorizácie aj pri chybe načítania profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                }
            });

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
            }
        }
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
