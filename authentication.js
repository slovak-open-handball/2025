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
    errorMessageDiv.textContent = 'Táto aplikácia nemôže byť zobrazená v iframe.';
    errorMessageDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: red; font-size: 24px; text-align: center;';
    document.body.appendChild(errorMessageDiv);
}

// Funkcia na overenie prístupu na základe role
function checkPageAuthorization(userProfileData, path) {
    const publicPages = ['index.html', 'login.html', 'register.html'];
    const adminPages = ['logged-in-users.html'];
    const loggedInPages = [
        'logged-in-my-data.html',
        'logged-in-registration.html'
    ];

    const currentPage = path.split('/').pop();

    if (publicPages.includes(currentPage)) {
        return true; // Verejné stránky sú vždy prístupné
    }

    if (!userProfileData) {
        // Používateľ nie je prihlásený, ale pokúša sa o prístup k chránenej stránke
        return false;
    }

    const userRole = userProfileData.role;

    if (adminPages.includes(currentPage)) {
        return userRole === 'admin';
    }

    if (loggedInPages.includes(currentPage)) {
        return userRole === 'user' || userRole === 'admin';
    }

    return false;
}

// Inicializácia Firebase a nastavenie listenerov
document.addEventListener('DOMContentLoaded', async () => {
    try {
        let firebaseConfig;
        const defaultFirebaseConfig = {
            apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
            authDomain: "soh2025-2s0o2h5.firebaseapp.com",
            projectId: "soh2025-2s0o2h5",
            storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
            messagingSenderId: "572988314768",
            appId: "1:572988314768:web:781e27eb035179fe34b415"
        };
        
        // Načítanie konfigurácie, s fallbackom na konštantné hodnoty
        try {
            firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : null) || defaultFirebaseConfig;
        } catch (e) {
            console.warn("AuthManager: Globálna konfigurácia Firebase je neplatná alebo chýba, použije sa predvolená konfigurácia.");
            firebaseConfig = defaultFirebaseConfig;
        }

        const app = initializeApp(firebaseConfig);
        window.db = getFirestore(app);
        window.auth = getAuth(app);

        // Skúsi sa prihlásiť pomocou custom tokenu
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) {
            await signInWithCustomToken(window.auth, initialAuthToken);
            console.log("AuthManager: Úspešné prihlásenie pomocou custom tokenu.");
        } else {
            // Ak token nie je k dispozícii, prihlási sa anonymne
            await signInAnonymously(window.auth);
            console.log("AuthManager: Úspešné anonymné prihlásenie.");
        }
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase alebo prihlásení:", e);
    }

    // Listener pre zmeny stavu autentifikácie
    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, načítavam profil.");

            // Použitie dynamického appId pre cestu k profilu, s fallbackom na projectId z konfigurácie
            const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
            const userDocRef = doc(window.db, 'artifacts', appId, 'users', user.uid);

            // Listener pre dáta profilu v reálnom čase
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
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
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
            });

            // Čistenie pri odhlásení
            return () => unsubscribe();
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                window.location.href = 'index.html';
            }
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
});
