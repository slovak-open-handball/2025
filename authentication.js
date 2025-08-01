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
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "338981442111",
    appId: "1:338981442111:web:37e3ff0d64f1d43a60a7e6",
    measurementId: "G-G59L921R68"
};

/**
 * Inicializuje Firebase aplikáciu a služby.
 */
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

// Funkcia pre kontrolu autorizácie stránky
// V našom prípade zatiaľ len presmeruje na index.html, ak používateľ nie je prihlásený
const checkPageAuthorization = (userProfile, path) => {
    // V tejto aplikácii všetky stránky vyžadujú prihlásenie, okrem 'index.html', 'login.html' a 'registration.html'
    const publicPaths = ['/index.html', '/login.html', '/registration.html', '/'];
    if (!userProfile && !publicPaths.includes(path)) {
        console.log(`AuthManager: Neprihlásený používateľ, presmerujem na login. Path: ${path}`);
        window.location.href = 'index.html';
    }
};

/**
 * Spravuje zmeny stavu autentifikácie používateľa.
 */
const handleAuthState = () => {
    let unsubscribeUserDoc = null;

    onAuthStateChanged(window.auth, (user) => {
        // Zastavíme predchádzajúceho listenera, ak existuje
        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }
        window.isGlobalAuthReady = true;

        if (user) {
            console.log(`AuthManager: Používateľ je prihlásený, UID: ${user.uid}`);
            
            // Kľúčová zmena: Načítavanie dát z priečinka 'users'
            const userDocRef = doc(window.db, 'users', user.uid);

            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Profil používateľa načítaný a aktualizovaný.", window.globalUserProfileData);
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                    checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
                } else {
                    console.warn("AuthManager: Profil používateľa neexistuje. Nastavujem na null.");
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

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;

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
