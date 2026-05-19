// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false;
window.globalUserProfileData = null;
window.auth = null;
window.db = null;
window.showGlobalNotification = null;
window.reauthenticateWithCredential = null;
window.as = null;
window.EmailAuthProvider = null;
window.verifyBeforeUpdateEmail = null;
window.isRegisteringAdmin = false;

// Import necessary Firebase functions
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    reauthenticateWithCredential,
    updateEmail,
    EmailAuthProvider,
    verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Vložený konfiguračný objekt
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "367316414164",
    appId: "1:367316414164:web:fce079e1c7f4223292490b"
};

// URL adresa Google Apps Scriptu na odosielanie e-mailov
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

// Definovanie globálnych premenných
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const getAppBasePath = () => {
    const appYearMatch = appId.match(/(\d{4})/);
    const appYear = appYearMatch ? appYearMatch[1] : '2025';
    return `/${appYear}`;
};

const appBasePath = getAppBasePath();

// Zoznam stránok prístupných len pre adminov
const blockedPages = [
    'logged-in-add-categories.html',
    'logged-in-add-groups.html',
    'logged-in-teams-in-groups.html',
    'logged-in-tournament-settings.html',
    'logged-in-all-registrations.html',
    'logged-in-users.html',
    'logged-in-notifications.html',
    'logged-in-teams-in-groups.html',
    'logged-in-map.html',
    'logged-in-teams-in-accommodation.html'
];

// Inicializácia Firebase aplikácie
let app;
let db;
let auth;

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log("AuthManager: Firebase inicializovaný.");

        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Pomocná funkcia na kontrolu, či sme na login stránke
const isOnLoginPage = () => {
    const currentPath = window.location.pathname;
    // Kontroluje, či cesta končí na 'login.html' (napr. /2025/login.html alebo /nazov-projektu/login.html)
    const result = currentPath.endsWith('/login.html') || currentPath === '/login.html';
    console.log(`AuthManager: isOnLoginPage() - currentPath: "${currentPath}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či sme na chránenej stránke
const isOnBlockedPage = () => {
    const currentPath = window.location.pathname;
    const result = blockedPages.some(page => currentPath.includes(page));
    console.log(`AuthManager: isOnBlockedPage() - currentPath: "${currentPath}", found: ${result}, matching page: ${blockedPages.find(page => currentPath.includes(page)) || 'none'}`);
    return result;
};

const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            
            // Správna cesta k profilovému dokumentu
            const userDocRef = doc(db, `users/${user.uid}`);
            
            const loadUserProfileData = async (retries = 0) => {
                const MAX_RETRIES = 2;
                const RETRY_DELAY = 100;

                try {
                    const docSnap = await getDoc(userDocRef);

                    if (!docSnap.exists()) {
                        if (retries < MAX_RETRIES) {
//                            console.warn(`AuthManager: Dokument profilu používateľa vo Firestore zatiaľ neexistuje. Pokus ${retries + 1}/${MAX_RETRIES}.`);
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            return loadUserProfileData(retries + 1);
                        } else {
//                            console.error("AuthManager: Dokument profilu používateľa nebol nájdený.");
                            window.globalUserProfileData = null;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                            return;
                        }
                    }

                    if (window.unsubscribeUserDoc) {
                        window.unsubscribeUserDoc();
                    }

                    window.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const userProfileData = { id: snapshot.id, ...snapshot.data() };
                            
                            // Ak prebieha registrácia admina
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                console.log("AuthManager: Prebieha registrácia administrátora.");
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                return;
                            }

                            // Neschválený administrátor
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
                                console.warn("AuthManager: Nepovolený administrátor detekovaný.");
                                // ... email logika zostáva rovnaká
                                signOut(auth).then(() => {
                                    window.globalUserProfileData = null;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                    window.location.href = `${appBasePath}/login.html?status=unapproved_admin`; 
                                });
                                return;
                            } 
                            
                            // Schválení používatelia
                            else if (userProfileData.approved === true) {
                                const targetPathMyData = `${appBasePath}/logged-in-my-data.html`;

                                if (isOnLoginPage()) {
                                    console.log(`AuthManager: Schválený používateľ sa prihlásil. Presmerovávam.`);
                                    window.location.href = targetPathMyData;
                                } 
                                else if (userProfileData.role !== 'admin' && isOnBlockedPage()) {
                                    console.log(`AuthManager: Používateľ nemá prístup na túto stránku.`);
                                    window.location.href = targetPathMyData;
                                }
                            }

                            window.globalUserProfileData = userProfileData;
                            console.log("AuthManager: Používateľské dáta načítané:", userProfileData);
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                        } else {
                            console.error("AuthManager: Profil používateľa nebol nájdený!");
                            window.globalUserProfileData = null;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                        }
                    }, (error) => {
                        console.error("AuthManager: Chyba pri načítaní profilu:", error);
                        window.globalUserProfileData = null;
                        window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                    });
                } catch (error) {
                    console.error("AuthManager: Chyba pri načítaní profilu:", error);
                    window.globalUserProfileData = null;
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                }
            };

            loadUserProfileData();

        } else {
            console.log("AuthManager: Žiadny používateľ nie je prihlásený.");
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
            // KONTROLA: Ak nie je prihlásený žiadny používateľ a nachádzame sa na chránenej stránke,
            // okamžite presmerujeme na login.html
            const onLoginPage = isOnLoginPage();
            const onBlockedPage = isOnBlockedPage();
            
            console.log(`AuthManager: Kontrola presmerovania - onLoginPage: ${onLoginPage}, onBlockedPage: ${onBlockedPage}`);
            
            if (!onLoginPage && onBlockedPage) {
                console.log("AuthManager: Neprihlásený používateľ na chránenej stránke. Presmerovávam na login.");
                const loginUrl = `${appBasePath}/login.html`;
                console.log(`AuthManager: Presmerúvam na: ${loginUrl}`);
                window.location.href = loginUrl;
                return;
            } else {
                console.log("AuthManager: Žiadne presmerovanie nebolo spustené.");
            }
        }

        window.addEventListener('beforeunload', () => {
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
