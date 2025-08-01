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

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Funkcia na inicializáciu Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializovaný.");
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Funkcia na overenie oprávnení na prístup k stránke
// Ak stránka nie je verejná a používateľ nie je prihlásený, presmeruje ho na prihlasovaciu stránku
const checkPageAuthorization = (userProfileData, pathname) => {
    // Skontrolujeme, či je aktuálna stránka vo verejnom zozname
    const isPublicPage = PUBLIC_PAGES.some(publicPath => pathname.endsWith(publicPath));
    
    // Ak je stránka verejná, autorizácia je povolená bez ďalšej kontroly
    if (isPublicPage) {
        console.log(`AuthManager: Prístup povolený na verejnej stránke '${pathname}'.`);
        return;
    }

    // Ak stránka nie je verejná, vyžaduje sa prihlásenie
    if (!userProfileData) {
        console.warn(`AuthManager: Prístup zamietnutý. Používateľ nie je prihlásený a stránka '${pathname}' nie je verejná.`);
        window.location.href = 'login.html';
        return;
    }

    // Pre prihlásených používateľov môžeme pridať ďalšiu logiku na základe rolí
    // const accessMap = {
    //     'logged-in-my-data.html': ['user', 'admin', 'hall'],
    //     'logged-in-registration.html': ['admin', 'hall'],
    // };
    // const userRole = userProfileData.role;
    // const requiredRoles = accessMap[pathname] || ['user', 'admin', 'hall'];
    // if (!requiredRoles.includes(userRole)) {
    //     console.warn(`AuthManager: Prístup zamietnutý. Používateľ s rolou '${userRole}' nemá prístup na stránku '${pathname}'.`);
    //     window.location.href = 'index.html';
    // } else {
    //     console.log(`AuthManager: Prístup povolený pre prihláseného používateľa s rolou '${userRole}' na stránke '${pathname}'.`);
    // }
    console.log(`AuthManager: Prístup povolený pre prihláseného používateľa na stránke '${pathname}'.`);
};

// Funkcia, ktorá sa spustí pri zmene stavu autentifikácie
const handleAuthState = () => {
    onAuthStateChanged(window.auth, (user) => {
        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            window.isGlobalAuthReady = true;

            // Načítame profilové dáta používateľa z databázy
            const userProfileRef = doc(window.db, `users/${user.uid}`);
            
            // onSnapshot zabezpečí, že dáta sú vždy aktuálne
            const unsubscribeUserDoc = onSnapshot(userProfileRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { ...docSnap.data(), uid: user.uid };
                    console.log("AuthManager: Profil používateľa načítaný a aktualizovaný.");

                    // Odošleme udalosť, že sa globálne dáta aktualizovali
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                    checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
                } else {
                    console.warn("AuthManager: Profil používateľa sa nenašiel v databáze.");
                    window.globalUserProfileData = null;
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
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
