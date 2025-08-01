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
    messagingSenderId: "389209565551",
    appId: "1:389209565551:web:da9096773347f3b8909d84",
    measurementId: "G-F67T888Y0H"
};

// Zoznam stránok, ktoré vyžadujú autentifikáciu
const protectedPages = [
    '/logged-in-my-data.html',
    '/logged-in-registration.html',
];

/**
 * Kontroluje, či má používateľ prístup na danú stránku.
 * Ak nemá, presmeruje ho na príslušnú stránku (napr. prihlásenie).
 * @param {object|null} userProfile - Profilové dáta používateľa alebo null.
 * @param {string} pathname - Cesta aktuálnej stránky (window.location.pathname).
 */
const checkPageAuthorization = (userProfile, pathname) => {
    // Stránka index.html je vždy verejná, autorizácia sa na ňu nevzťahuje
    if (pathname === '/' || pathname === '/index.html') {
        return true;
    }

    const isProtected = protectedPages.includes(pathname);
    const isAuthenticated = !!userProfile;

    if (isProtected && !isAuthenticated) {
        console.warn(`AuthManager: Neautorizovaný prístup na ${pathname}. Presmerujem na prihlásenie.`);
        window.location.href = 'login.html';
        return false;
    }
    
    if (!isProtected && isAuthenticated && pathname.includes('login.html')) {
        console.log("AuthManager: Používateľ je už prihlásený, presmerujem na hlavnú stránku.");
        window.location.href = 'index.html'; // Presmerujeme na index.html, ak je prihlásený
        return false;
    }

    return true;
};

// Funkcia na inicializáciu Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

let unsubscribeUserDoc = null;

// Hlavná funkcia pre obsluhu stavu autentifikácie
const handleAuthState = () => {
    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
            unsubscribeUserDoc = null;
        }

        if (user) {
            console.log("AuthManager: Používateľ je prihlásený.", user.uid);
            const userDocRef = doc(window.db, `artifacts/soh2025-2s0o2h5/users/${user.uid}/profile/data`);

            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Profil používateľa načítaný/aktualizovaný.");
                    
                    // Odošleme udalosť, aby ostatné moduly vedeli, že dáta sú pripravené
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));
                    
                    // Kontrola autorizácie po načítaní dát
                    if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                        console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                    }
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
