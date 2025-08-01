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
    projectId: "soh2025-2s0o2h5"
};

// Polia s URL, ktoré vyžadujú rôzne roly.
// Uľahčuje to spravovanie autorizácie.
const ROLE_REQUIRED_PAGES = {
    'admin': ['/admin.html', '/admin-edit-player.html'],
    'hall': ['/hall.html'],
    'user': ['/logged-in-registration.html', '/logged-in-my-data.html']
};

/**
 * Kontroluje, či má používateľ prístup na aktuálnu stránku na základe jeho roly.
 * Ak nemá, presmeruje ho na login.html alebo index.html
 * @param {object|null} userProfileData - Dáta profilu aktuálneho používateľa.
 * @param {string} pathname - Cesta aktuálnej stránky (window.location.pathname).
 * @returns {boolean} True, ak má používateľ prístup, inak false.
 */
const checkPageAuthorization = (userProfileData, pathname) => {
    // Ak je používateľ prihlásený, ale nemá dáta profilu, môžeme ho poslať na prihlásenie.
    // To môže nastať, ak používateľ bol zmazaný z databázy alebo ešte nemá profil
    if (window.auth.currentUser && !userProfileData) {
        console.warn("AuthManager: Používateľ je prihlásený, ale nenašli sa dáta profilu.");
        window.location.href = '/login.html';
        return false;
    }

    // Ak nie je prihlásený vôbec, presmerujeme ho na login.html, ak nie je už na logine alebo na indexe
    // a stránka vyžaduje autentifikáciu.
    if (!window.auth.currentUser) {
        // Zoznam stránok, ktoré si vyžadujú prihlásenie
        const loggedInPages = Object.values(ROLE_REQUIRED_PAGES).flat();
        
        if (loggedInPages.includes(pathname)) {
            console.warn("AuthManager: Používateľ nie je prihlásený, presmerovanie na login.");
            window.location.href = '/login.html';
            return false;
        }

        return true; // Na verejných stránkach netreba presmerovávať
    }

    // Ak je prihlásený, skontrolujeme rolu pre prístup na špecifické stránky
    if (userProfileData && userProfileData.role) {
        for (const role in ROLE_REQUIRED_PAGES) {
            if (ROLE_REQUIRED_PAGES[role].includes(pathname)) {
                if (role !== userProfileData.role) {
                    console.warn(`AuthManager: Rola '${userProfileData.role}' nemá prístup na '${pathname}'. Presmerovanie.`);
                    window.location.href = '/login.html'; // Presmerovanie na login, ak rola nesedí
                    return false;
                }
            }
        }
    } else {
        // Ak používateľ nemá priradenú rolu, presmerujeme ho na index.html.
        console.warn("AuthManager: Používateľ nemá priradenú rolu.");
        // Ak sa používateľ pokúša dostať na prihlásenú stránku bez roly, pošleme ho na login.
        const loggedInPages = Object.values(ROLE_REQUIRED_PAGES).flat();
        if (loggedInPages.includes(pathname)) {
            window.location.href = '/login.html';
            return false;
        }
    }

    console.log(`AuthManager: Prístup na stránku '${pathname}' povolený pre rolu '${userProfileData ? userProfileData.role : 'neznáma'}'.`);
    return true;
};

// Funkcia pre odhlásenie používateľa
const handleLogout = async () => {
    try {
        await signOut(window.auth);
        console.log("AuthManager: Používateľ bol odhlásený.");
        window.location.href = '/index.html'; // Presmerovanie na domovskú stránku
    } catch (error) {
        console.error("AuthManager: Chyba pri odhlásení:", error);
        if (window.showGlobalNotification) {
            window.showGlobalNotification('Chyba pri odhlásení. Skúste to prosím znova.', 'error');
        }
    }
};

const setupFirebase = () => {
    if (typeof window.firebaseApp === 'undefined') {
        window.firebaseApp = initializeApp(firebaseConfig);
        window.auth = getAuth(window.firebaseApp);
        window.db = getFirestore(window.firebaseApp);
    }
};

let unsubscribeUserDoc = null;
const handleAuthState = () => {
    onAuthStateChanged(window.auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc(); // Odhlásime sa z predchádzajúceho listenera
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);

            const userDocRef = doc(window.db, "users", user.uid);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                } else {
                    console.warn("AuthManager: Dokument profilu pre prihláseného používateľa neexistuje.");
                    window.globalUserProfileData = null;
                }
                
                // Vytvorenie a odoslanie vlastnej udalosti po aktualizácii dát
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

// Zverejníme funkcie, aby boli dostupné globálne
window.handleLogout = handleLogout;
window.checkPageAuthorization = checkPageAuthorization;
