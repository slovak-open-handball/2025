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
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Zabezpečíme, že appId je definované (používame globálnu premennú, ak je dostupná, inak vezmeme z configu)
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId; 


// Inicializuje Firebase služby
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

// Funkcia pre kontrolu autorizácie na základe cesty a profilových dát
const checkPageAuthorization = (userProfileData, pathname) => {
    const protectedPages = ['/logged-in-my-data.html', '/logged-in-registration.html'];
    const isProtectedPage = protectedPages.some(page => pathname.includes(page));

    if (!userProfileData && isProtectedPage) {
        window.location.href = 'login.html';
        return false;
    }

    if (userProfileData && pathname.includes('/login.html')) {
        window.location.href = 'logged-in-my-data.html';
        return false;
    }
    
    return true;
};

// Funkcia, ktorá spravuje stav autentifikácie a načítava dáta používateľa
const handleAuthState = () => {
    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;
        let unsubscribeUserDoc = null;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            
            // Nastavenie poslucháča na zmeny v profile používateľa v databáze Firestore.
            const userDocRef = doc(window.db, 'users', user.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Údaje používateľa načítané a aktualizované.");
                } else {
                    console.warn("AuthManager: Údaje používateľa v databáze neexistujú.");
                    window.globalUserProfileData = null;
                }
                
                // Dispečujeme globálnu udalosť, ktorá informuje ostatné komponenty
                window.dispatchEvent(new Event('globalDataUpdated'));

                // Kontrola autorizácie po načítaní dát
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                }
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                window.dispatchEvent(new Event('globalDataUpdated'));
                checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
            });

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            window.dispatchEvent(new Event('globalDataUpdated'));
            
            // Kontrola autorizácie stránky po odhlásení
            checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
        }

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
