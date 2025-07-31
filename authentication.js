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

// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Táto aplikácia nemôže byť zobrazená v rámčeku (iframe). Prosím, otvorte ju priamo v prehliadači.';
    errorMessageDiv.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; color: white; background-color: #ef4444; font-size: 1.5rem; text-align: center; border-radius: 8px;';
    document.body.appendChild(errorMessageDiv);
}

// Zabezpečíme, že appId a Firebase Config sú definované
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Inicializácia Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase služby inicializované.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Funkcia na overenie autorizácie stránky
const checkPageAuthorization = (userProfile, path) => {
    const publicRoutes = ['/index.html', '/login.html', '/about.html'];
    const loggedInRoutes = ['/logged-in-my-data.html', '/logged-in-registration.html'];
    const adminRoutes = ['/admin.html'];

    if (publicRoutes.includes(path)) {
        return true;
    }

    if (!userProfile) {
        if (loggedInRoutes.includes(path) || adminRoutes.includes(path)) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    if (userProfile.role === 'admin' && adminRoutes.includes(path)) {
        return true;
    }

    if (loggedInRoutes.includes(path)) {
        return true;
    }
    
    // Ak je používateľ prihlásený a pokúša sa o prístup k admin stránke bez oprávnení
    if (userProfile.role !== 'admin' && adminRoutes.includes(path)) {
        window.location.href = 'logged-in-my-data.html';
        return false;
    }
    
    return true;
};

// Listener pre zmeny stavu autentifikácie
const handleAuthState = () => {
    if (!window.auth || !window.db) {
        console.error("AuthManager: Autentifikácia alebo databáza nie sú inicializované.");
        return;
    }

    onAuthStateChanged(window.auth, async (user) => {
        window.isGlobalAuthReady = true;

        // Prihlásenie anonymným používateľom, ak token nie je k dispozícii
        if (typeof __initial_auth_token !== 'undefined' && !user) {
            try {
                await signInWithCustomToken(window.auth, __initial_auth_token);
                user = window.auth.currentUser;
                console.log("AuthManager: Prihlásenie s vlastným tokenom prebehlo úspešne.");
            } catch (error) {
                console.error("AuthManager: Chyba pri prihlasovaní s vlastným tokenom:", error);
                await signInAnonymously(window.auth);
                user = window.auth.currentUser;
            }
        } else if (!user) {
            await signInAnonymously(window.auth);
            user = window.auth.currentUser;
        }

        let unsubscribeUserDoc;
        
        if (user) {
            console.log(`AuthManager: Používateľ je prihlásený. UID: ${user.uid}`);
            
            const userDocRef = doc(window.db, 'users', user.uid);
            
            // Nastavíme real-time listener, ktorý bude spúšťať aktualizácie
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = docSnap.data();
                    console.log("AuthManager: Profil používateľa načítaný v reálnom čase.");
                } else {
                    window.globalUserProfileData = null;
                    console.warn("AuthManager: Profil používateľa neexistuje v databáze.");
                }
                
                // Kontrola autorizácie stránky po každej aktualizácii profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                }
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                // Kontrola autorizácie aj pri chybe načítania profilu
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            });

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
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
