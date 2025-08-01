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
    // Zoznam obsahuje len názvy súborov pre robustnejšiu kontrolu cesty.
    const publicPages = ['/', 'index.html', 'login.html', 'register.html'];
    const loggedInPages = ['logged-in-my-data.html'];
    const adminPages = ['admin-register.html', 'admin-dashboard.html'];
    const hallPages = ['hall-dashboard.html'];

    // Vylepšená kontrola, ktorá zistí, či cesta končí jedným z verejných súborov.
    // To rieši problém s cestami, ktoré obsahujú ID projektu (napr. /2025/index.html).
    const pathEndsWithPublicPage = publicPages.some(page => {
        // Špeciálne ošetrenie pre root cestu '/'
        if (page === '/' && path.endsWith('/')) {
            return true;
        }
        return path.endsWith('/' + page);
    });

    // DÔLEŽITÁ ZMENA: Ak je stránka verejná, umožníme prístup všetkým
    // Toto pravidlo je nadradené a platí pre prihlásených aj neprihlásených používateľov
    if (pathEndsWithPublicPage) {
        console.log(`AuthManager: Stránka '${path}' je verejná, prístup povolený.`);
        return true;
    }

    // Ak je používateľ odhlásený a stránka nie je verejná, presmerujeme ho
    if (!userProfile) {
        console.warn("AuthManager: Používateľ je odhlásený a stránka nie je verejná, presmerovávam na prihlásenie.");
        // ZMENA: Presmerovanie na relatívnu cestu, aby fungovalo na GitHub Pages
        window.location.href = './login.html';
        return false;
    }
    
    // Ak je používateľ prihlásený, pokračujeme v kontrole prístupu na základe roly
    const userRole = userProfile.role;

    // Kontrola prístupu na základe roly
    if (adminPages.includes(path.split('/').pop()) && userRole !== 'admin') {
        console.warn(`AuthManager: Prihlásený používateľ s rolou '${userRole}' nemá prístup na admin stránku.`);
        window.location.href = './logged-in-my-data.html';
        return false;
    }
    if (hallPages.includes(path.split('/').pop()) && userRole !== 'hall') {
        console.warn(`AuthManager: Prihlásený používateľ s rolou '${userRole}' nemá prístup na stránku haly.`);
        window.location.href = './logged-in-my-data.html';
        return false;
    }
    if (loggedInPages.includes(path.split('/').pop()) && (userRole !== 'user' && userRole !== 'admin' && userRole !== 'hall')) {
        console.warn(`AuthManager: Prihlásený používateľ s rolou '${userRole}' nemá prístup na prihlásenú stránku.`);
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
        // Po odhlásení sa onAuthStateChanged listener postará o presmerovanie
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
        // Počiatočná kontrola stavu autentifikácie prebehla
        if (!window.isGlobalAuthReady) {
            window.isGlobalAuthReady = true;
            console.log("AuthManager: Initial auth state checked.");
        }

        // Ak už existuje predchádzajúci listener, odhlásime ho, aby sme zabránili únikom pamäte
        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);

            const userDocRef = doc(window.db, 'users', user.uid);
            
            // Nastavíme real-time listener na dáta profilu používateľa
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    // Dáta boli načítané
                    const userProfileData = { id: docSnap.id, ...docSnap.data() };
                    window.globalUserProfileData = userProfileData;

                    // VYpiseme dáta do konzoly, ako bolo požadované
                    console.log("AuthManager: Používateľské dáta načítané:", userProfileData);

                    // Odošleme globálnu udalosť s dátami, ktorú môže použiť 'logged-in-my-data.js'
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));

                    // Kontrola autorizácie po načítaní dát
                    if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                        console.warn("AuthManager: Autorizácia zlyhala alebo prebehlo presmerovanie.");
                    }
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
