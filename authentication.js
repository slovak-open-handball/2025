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
    messagingSenderId: "337775986422",
    appId: "1:337775986422:web:15f7f9175466c1b3c545e8"
};

// Funkcia na inicializáciu Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializované.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Funkcia, ktorá skontroluje, či má používateľ prístup na danú stránku
const checkPageAuthorization = (userProfile, path) => {
    // Definujeme povolené roly pre jednotlivé stránky.
    const publicPages = ['index.html', 'login.html', 'register.html'];
    const loggedInPages = ['logged-in-my-data.html'];
    const adminPages = ['admin-register.html', 'admin-dashboard.html'];
    const hallPages = ['hall-dashboard.html'];

    // DÔLEŽITÁ ZMENA: Spoľahlivejšie získanie názvu súboru
    let currentPageName;
    if (path.endsWith('/')) {
        // Ak cesta končí lomkou, ide o root, takže predpokladáme 'index.html'
        currentPageName = 'index.html';
    } else {
        // Inak získame názov súboru z cesty (ignorujeme parametre a fragmenty)
        currentPageName = path.split('/').pop().split('?')[0].split('#')[0];
    }
    
    // Logovanie pre účely ladenia, aby sme videli, čo sa deje
    console.log(`AuthManager: Kontrola autorizácie pre cestu: '${path}'`);
    console.log(`AuthManager: Identifikovaná stránka: '${currentPageName}'`);

    // Skontrolujeme, či je aktuálna stránka vo verejnom zozname
    const isPublicPage = publicPages.includes(currentPageName);

    // DÔLEŽITÁ ZMENA: Ak je stránka verejná, umožníme prístup všetkým
    // Toto pravidlo je nadradené a platí pre prihlásených aj neprihlásených používateľov
    if (isPublicPage) {
        console.log(`AuthManager: Stránka '${path}' je verejná, prístup povolený.`);
        return true;
    }

    // Ak je používateľ odhlásený a stránka nie je verejná, presmerujeme ho
    if (!userProfile) {
        console.warn("AuthManager: Používateľ je odhlásený a stránka nie je verejná, presmerovávam na prihlásenie.");
        window.location.href = './login.html';
        return false;
    }
    
    // Ak je používateľ prihlásený, pokračujeme v kontrole prístupu na základe roly
    const userRole = userProfile.role;
    console.log(`AuthManager: Prihlásený používateľ s rolou '${userRole}'.`);

    // Kontrola prístupu na základe roly
    if (adminPages.includes(currentPageName) && userRole !== 'admin') {
        console.warn(`AuthManager: Používateľ nemá prístup na admin stránku.`);
        window.location.href = './logged-in-my-data.html';
        return false;
    }
    if (hallPages.includes(currentPageName) && userRole !== 'hall') {
        console.warn(`AuthManager: Používateľ nemá prístup na stránku haly.`);
        window.location.href = './logged-in-my-data.html';
        return false;
    }
    if (loggedInPages.includes(currentPageName) && (userRole !== 'user' && userRole !== 'admin' && userRole !== 'hall')) {
        console.warn(`AuthManager: Používateľ nemá prístup na prihlásenú stránku.`);
        window.location.href = './logged-in-my-data.html';
        return false;
    }

    // Ak sa prihlásený používateľ dostane až sem, má prístup
    console.log(`AuthManager: Prihlásený používateľ s rolou '${userRole}' má prístup na stránku '${path}'.`);
    return true;
};

// Funkcia pre odhlásenie používateľa
const handleLogout = async () => {
    try {
        await signOut(window.auth);
        console.log("AuthManager: Používateľ bol úspešne odhlásený.");
        window.showGlobalNotification('Boli ste úspešne odhlásený.', 'success');
    } catch (error) {
        console.error("AuthManager: Chyba pri odhlasovaní:", error);
        window.showGlobalNotification('Chyba pri odhlasovaní. Skúste to prosím znova.', 'error');
    }
};
window.handleLogout = handleLogout; // Sprístupníme funkciu globálne

// Hlavná funkcia na spracovanie stavu autentifikácie
const handleAuthState = () => {
    let unsubscribeUserDoc = null;

    onAuthStateChanged(window.auth, async (user) => {
        if (!window.isGlobalAuthReady) {
            window.isGlobalAuthReady = true;
            console.log("AuthManager: Initial auth state checked.");
        }

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            const userDocRef = doc(window.db, 'users', user.uid);
            
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userProfileData = { id: docSnap.id, ...docSnap.data() };
                    window.globalUserProfileData = userProfileData;
                    console.log("AuthManager: Používateľské dáta načítané:", userProfileData);
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                    checkPageAuthorization(window.globalUserProfileData, window.location.pathname);
                } else {
                    console.error("AuthManager: Profil používateľa nebol nájdený!");
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
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
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

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
