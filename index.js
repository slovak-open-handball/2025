// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií

// Pole verejných stránok, ktoré nevyžadujú prihlásenie
// Toto pole je možné v budúcnosti jednoducho rozšíriť
const PUBLIC_PAGES = [
    '/',
    '/index.html',
    '/login.html',
    // Ďalšie verejné stránky môžu byť pridané sem
];

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase, podľa požiadavky
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Pomocná funkcia na overenie autorizácie stránky
function checkPageAuthorization(userProfile, path) {
    const isPublicPage = PUBLIC_PAGES.includes(path);
    const isAuthenticated = !!userProfile;

    if (!isPublicPage && !isAuthenticated) {
        // Ak používateľ nie je prihlásený a stránka nie je verejná, presmerujeme ho na prihlasovaciu stránku
        console.log(`AuthManager: Neautorizovaný prístup k ${path}. Presmerovanie na /login.html.`);
        window.location.href = '/login.html';
    }
}

// Inicializácia Firebase a nastavenie globálnych premenných
function setupFirebase() {
    try {
        // Predpokladáme, že appId a initialAuthToken sú definované globálne v HTML
        if (!window.initialAuthToken || !window.appId) {
            console.error("AuthManager: Globálne premenné 'initialAuthToken' alebo 'appId' nie sú definované.");
            return;
        }

        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        
        // Dôležitý fix: Sprístupníme funkciu 'doc' globálne
        window.doc = doc; 

        console.log("AuthManager: Firebase inicializované.");

    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
}


// Spracovanie stavu autentifikácie
const handleAuthState = () => {
    onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            
            // Načítanie profilu používateľa z Firestore
            // Používame onSnapshot pre sledovanie zmien v reálnom čase
            const userDocRef = doc(window.db, `artifacts/${window.appId}/users/${user.uid}/profile/data`);
            
            const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = docSnap.data();
                    console.log("AuthManager: Profil používateľa načítaný a aktuálny.", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Profil používateľa nebol nájdený.");
                    window.globalUserProfileData = null;
                }

                window.isGlobalAuthReady = true;
                // Odošleme udalosť, že dáta boli aktualizované
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                // Skontrolujeme autorizáciu po načítaní dát
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            });

            // Pridáme listener na odhlásenie, ak je užívateľ na stránke
            window.addEventListener('beforeunload', () => {
                if (unsubscribeUserDoc) {
                    unsubscribeUserDoc();
                }
            });
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            window.isGlobalAuthReady = true;

            // Odošleme udalosť aj pri odhlásení
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
            // Kontrola autorizácie stránky po odhlásení
            checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};


// Spustenie inicializácie po načítaní DOM
window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
