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
    messagingSenderId: "360333550810",
    appId: "1:360333550810:web:12a64c4c519c72c1c3f550"
};

// Funkcia pre inicializáciu Firebase
const setupFirebase = () => {
    try {
        console.log("AuthManager: Inicializujem Firebase.");
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Pomocná funkcia pre overenie prístupu na stránku a presmerovanie
const checkPageAuthorization = (userProfileData, pathname) => {
    // Definícia prístupových pravidiel pre rôzne stránky
    const publicPages = ['/', '/index.html', '/login.html', '/register.html'];
    const loggedInPages = ['/logged-in-my-data.html', '/logged-in-registration.html'];
    const adminPages = ['/admin.html']; // Príklad pre admin stránky

    const isPublicPage = publicPages.some(page => pathname.endsWith(page));
    const isLoggedInPage = loggedInPages.some(page => pathname.endsWith(page));
    const isAdminPage = adminPages.some(page => pathname.endsWith(page));

    const isAuthenticated = userProfileData !== null;
    const userRole = userProfileData?.role || 'guest';

    if (isAuthenticated) {
        // Prihlásený používateľ
        if (!isLoggedInPage && !isPublicPage && !isAdminPage) {
            // Presmerovanie na domovskú stránku, ak sa prihlásený používateľ snaží dostať na neexistujúcu stránku
            window.location.href = '/index.html';
            return false;
        }
        if (isAdminPage && userRole !== 'admin') {
            // Ak nie je admin, presmeruj ho z admin stránky
            window.location.href = '/logged-in-my-data.html';
            return false;
        }
        // Ak sa prihlásený používateľ pokúsi ísť na 'login.html' alebo 'register.html', presmeruj ho na jeho profil.
        if (pathname.endsWith('login.html') || pathname.endsWith('register.html')) {
            window.location.href = '/logged-in-my-data.html';
            return false;
        }
    } else {
        // Neprihlásený používateľ
        if (isLoggedInPage || isAdminPage) {
            // Ak nie je prihlásený, presmeruj ho na prihlasovaciu stránku
            window.location.href = '/login.html';
            return false;
        }
    }
    return true; // Prístup povolený
};

// Funkcia na odhlásenie používateľa
window.handleLogout = async () => {
    if (window.auth) {
        try {
            await signOut(window.auth);
            console.log("AuthManager: Používateľ bol úspešne odhlásený.");
            window.showGlobalNotification('Úspešne ste sa odhlásili.');
            window.location.href = '/login.html'; // Presmerovanie na prihlasovaciu stránku
        } catch (error) {
            console.error("AuthManager: Chyba pri odhlasovaní:", error);
            window.showGlobalNotification('Chyba pri odhlasovaní: ' + error.message, 'error');
        }
    }
};

// Hlavná funkcia, ktorá sa stará o autentifikačný stav
const handleAuthState = () => {
    if (!window.auth || !window.db) {
        console.error("AuthManager: Firebase nebol inicializovaný. Nemôžem sledovať stav autentifikácie.");
        return;
    }
    
    // onAuthStateChanged je listener, ktorý sa spustí vždy, keď sa zmení stav prihlásenia
    onAuthStateChanged(window.auth, async (user) => {
        window.isGlobalAuthReady = true;
        
        if (user) {
            console.log("AuthManager: Používateľ je prihlásený:", user.uid);
            
            // Nastavenie onSnapshot listenera na dokument používateľa
            const userDocRef = doc(window.db, "users", user.uid);
            const unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Dáta profilu aktualizované.", window.globalUserProfileData);
                } else {
                    console.warn("AuthManager: Používateľský profil nebol nájdený pre UID:", user.uid);
                    window.globalUserProfileData = { id: user.uid, email: user.email, role: 'user' };
                }

                // Odoslanie udalosti s detailom dát
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: window.globalUserProfileData }));

                // Kontrola autorizácie po načítaní dát
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
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
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
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
