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
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkCcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "338981442111",
    appId: "1:338981442111:web:37e3ff0d64f1d43a60a7e6",
    measurementId: "G-G59L921R68"
};

// Zoznam stránok, ktoré sú verejné a nevyžadujú prihlásenie
const PUBLIC_PAGES = ['index.html', 'login.html', 'register.html'];

// Funkcia na inicializáciu Firebase
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

// Funkcia na overenie prístupu na stránku
const checkPageAuthorization = (userProfile, pathname) => {
    const currentPage = pathname.split('/').pop();
    const isPublicPage = PUBLIC_PAGES.includes(currentPage);
    const isLoggedIn = !!userProfile;
    
    console.log(`AuthManager: Kontrola prístupu na stránku '${currentPage}'. Používateľ prihlásený: ${isLoggedIn}. Stránka je verejná: ${isPublicPage}.`);

    // Presmeruje len vtedy, ak používateľ nie je prihlásený a stránka nie je verejná.
    // Zabraňuje presmerovaniu z verejných stránok.
    if (!isLoggedIn && !isPublicPage) {
        console.log("AuthManager: Neprihlásený používateľ a stránka nie je verejná, presmerujem na login.");
        window.location.href = 'login.html';
    }
};

// Funkcia na spracovanie stavu autentifikácie
const handleAuthState = () => {
    let unsubscribeUserDoc = null;

    onAuthStateChanged(window.auth, (user) => {
        // Zrušenie predchádzajúceho listenera, ak existuje
        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
            unsubscribeUserDoc = null;
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený. UID:", user.uid);

            // Nastavíme listener na zmeny v profile používateľa
            const userDocRef = doc(window.db, "users", user.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { ...docSnap.data(), uid: user.uid };
                    console.log("AuthManager: Dáta profilu načítané/aktualizované:", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Profil používateľa neexistuje v databáze.");
                    window.globalUserProfileData = { uid: user.uid, email: user.email };
                }

                window.isGlobalAuthReady = true;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                window.isGlobalAuthReady = true;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
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

        // Pridáme listener na odhlásenie, ak je užívateľ na stránke
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
    setupFirebase();
    handleAuthState();
});
