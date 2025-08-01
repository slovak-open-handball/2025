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

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let unsubscribeUserDoc = null;

// Funkcia na nastavenie Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializovaný.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Funkcia na kontrolu autorizácie stránky
const checkPageAuthorization = (userProfile, currentPath) => {
    const isPublicPage = PUBLIC_PAGES.includes(currentPath) || PUBLIC_PAGES.includes(currentPath + '/');
    const isLoggedIn = !!userProfile;
    const isLoginPage = currentPath.endsWith('login.html');

    // Ak je používateľ odhlásený a nie je na verejnej stránke, presmerujeme ho na prihlásenie
    if (!isLoggedIn && !isPublicPage && !isLoginPage) {
        console.log("AuthManager: Používateľ nie je prihlásený, presmerovanie na login.html.");
        window.location.href = 'login.html';
    }
};

// Funkcia, ktorá sa spustí pri zmene stavu autentifikácie
const handleAuthState = () => {
    onAuthStateChanged(window.auth, (user) => {
        // Ak existuje predchádzajúci listener, odhlásime ho
        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
            unsubscribeUserDoc = null;
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            window.isGlobalAuthReady = true;

            // Načítame dáta profilu používateľa v reálnom čase
            const userDocRef = doc(window.db, `artifacts/${window.appId}/users/${user.uid}/profile/userProfile`);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { ...docSnap.data(), uid: user.uid };
                    console.log("AuthManager: Dáta profilu používateľa načítané.", window.globalUserProfileData);
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                    checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
                } else {
                    console.log("AuthManager: Žiadne dáta profilu, vytváram základný profil.");
                    window.globalUserProfileData = { uid: user.uid, email: user.email };
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                    checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
                }
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
