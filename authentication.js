// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií
window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'; // Načíta global appId

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
    errorMessageDiv.style.color = 'red';
    errorMessageDiv.style.fontSize = '20px';
    errorMessageDiv.style.textAlign = 'center';
    errorMessageDiv.style.padding = '20px';
    document.body.appendChild(errorMessageDiv);
    throw new Error('Nepovolené zobrazenie v iframe.');
}

// Funkcia pre overenie autorizácie stránky
function checkPageAuthorization(userProfile, path) {
    const publicPaths = ['/index.html', '/login.html', '/register.html'];
    const loggedInPaths = ['/logged-in-my-data.html', '/logged-in-registration.html'];

    if (userProfile) {
        // Používateľ je prihlásený, overujeme prístup k stránkam pre prihlásených
        if (publicPaths.includes(path)) {
            // Ak sa prihlásený používateľ pokúša ísť na verejnú stránku, presmerujeme ho do jeho zóny
            window.location.href = 'logged-in-my-data.html';
            return false;
        }
        return true; // Má prístup k stránkam pre prihlásených
    } else {
        // Používateľ nie je prihlásený, overujeme prístup
        if (loggedInPaths.includes(path)) {
            // Ak sa neprihlásený používateľ pokúša ísť na stránku pre prihlásených, presmerujeme ho
            window.location.href = 'index.html';
            return false;
        }
        return true; // Má prístup k verejným stránkam
    }
}

// Funkcia pre inicializáciu Firebase
const setupFirebase = () => {
    try {
        const firebaseConfig = JSON.parse(window.__firebase_config);
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializované.");
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Funkcia pre správu stavu autentifikácie
const handleAuthState = () => {
    const auth = window.auth;
    const db = window.db;

    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;
        console.log("AuthManager: Stav autentifikácie skontrolovaný. isGlobalAuthReady nastavené na true.");

        if (user) {
            console.log("AuthManager: Používateľ je prihlásený. UID:", user.uid);

            const userId = user.uid;
            const userDocPath = `/artifacts/${window.appId}/users/${userId}/profile/data`;
            const userDocRef = doc(db, userDocPath);

            // Nastavíme listener na zmeny v dokumente profilu
            const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const profileData = { uid: user.uid, ...docSnap.data() };
                    console.log("AuthManager: Načítaný profil používateľa:", profileData);
                    window.globalUserProfileData = profileData;
                    
                    // Odoslanie udalosti, že dáta sú pripravené
                    window.dispatchEvent(new CustomEvent('profileDataLoaded'));

                } else {
                    console.warn("AuthManager: Žiadny profil používateľa nenájdený.");
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
