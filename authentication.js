// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.
// TERAZ S ANONYMOUN AUTENTIFIKÁCIOU PRE READ-ONLY PRÍSTUP

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
window.isAnonymousUser = false; // NOVÁ: Indikuje, či je používateľ anonymný

// Import necessary Firebase functions
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    signInAnonymously, // NOVÝ IMPORT
    reauthenticateWithCredential,
    updateEmail,
    EmailAuthProvider,
    verifyBeforeUpdateEmail,
    linkWithCredential // Pre upgrade z anonymného na trvalý účet
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    onSnapshot,
    setDoc // Pre vytvorenie anonymného profilu
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

// ===== NOVÁ FUNKCIA PRE AUTOMATICKÚ ANONYMOUN AUTENTIFIKÁCIU =====
const autoSignInAnonymously = async () => {
    try {
        console.log("AuthManager: Pokus o anonymné prihlásenie...");
        const userCredential = await signInAnonymously(auth);
        console.log("AuthManager: Anonymné prihlásenie úspešné:", userCredential.user.uid);
        
        // Vytvorenie základného profilu pre anonymného používateľa v Firestore
        const anonymousUserRef = doc(db, `users/${userCredential.user.uid}`);
        const anonymousUserSnap = await getDoc(anonymousUserRef);
        
        if (!anonymousUserSnap.exists()) {
            // Vytvoríme anonymný profil
            await setDoc(anonymousUserRef, {
                uid: userCredential.user.uid,
                role: 'anonymous',
                approved: true,
                createdAt: new Date().toISOString(),
                isAnonymous: true
            });
            console.log("AuthManager: Anonymný profil vytvorený v databáze");
        }
        
        return userCredential.user;
    } catch (error) {
        console.error("AuthManager: Chyba pri anonymnom prihlásení:", error);
        return null;
    }
};

// Funkcia na upgrade z anonymného na trvalý účet
window.upgradeAnonymousToPermanent = async (email, password, userData) => {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
        console.error("Nie je možné upgradovať - používateľ nie je anonymný");
        return { success: false, error: "User is not anonymous" };
    }
    
    try {
        // Vytvorenie credential pre email/password
        const credential = EmailAuthProvider.credential(email, password);
        
        // Prepojenie anonymného účtu s email účtom
        const userCredential = await linkWithCredential(auth.currentUser, credential);
        console.log("Účet úspešne upgradovaný na trvalý");
        
        // Aktualizácia profilu v databáze
        const userRef = doc(db, `users/${userCredential.user.uid}`);
        await setDoc(userRef, {
            ...userData,
            uid: userCredential.user.uid,
            email: email,
            isAnonymous: false,
            upgradedAt: new Date().toISOString()
        }, { merge: true });
        
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Chyba pri upgrade účtu:", error);
        return { success: false, error: error.message };
    }
};

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Povolenie anonymnej autentifikácie
        auth.settings = { ...auth.settings, persistence: 'local' };
        
        console.log("AuthManager: Firebase inicializovaný.");

        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        window.upgradeAnonymousToPermanent = upgradeAnonymousToPermanent;
        
        // Kontrola, či je používateľ anonymný
        window.isAnonymous = () => {
            return auth.currentUser && auth.currentUser.isAnonymous === true;
        };
        
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            console.log("AuthManager: Je anonymný?", user.isAnonymous);
            
            window.isAnonymousUser = user.isAnonymous === true;
            
            // Správna cesta k profilovému dokumentu
            const userDocRef = doc(db, `users/${user.uid}`);
            
            const loadUserProfileData = async (retries = 0) => {
                const MAX_RETRIES = 5;
                const RETRY_DELAY = 500;

                try {
                    const docSnap = await getDoc(userDocRef);

                    if (!docSnap.exists()) {
                        if (retries < MAX_RETRIES) {
                            console.warn(`AuthManager: Dokument profilu používateľa vo Firestore zatiaľ neexistuje. Pokus ${retries + 1}/${MAX_RETRIES}.`);
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            return loadUserProfileData(retries + 1);
                        } else {
                            console.error("AuthManager: Dokument profilu používateľa nebol nájdený.");
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
                            
                            // ŠPECIÁLNA LOGIKA PRE ANONYMNYCH POUŽÍVATEĽOV
                            if (user.isAnonymous || userProfileData.role === 'anonymous') {
                                console.log("AuthManager: Anonymný používateľ - read-only režim");
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                
                                // Anonymní používatelia nemôžu pristupovať na admin stránky
                                const currentPath = window.location.pathname;
                                if (blockedPages.some(page => currentPath.includes(page))) {
                                    console.log("AuthManager: Anonymný používateľ nemá prístup na túto stránku");
                                    window.location.href = `${appBasePath}/index.html`;
                                }
                                return;
                            }
                            
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
                                const currentPath = window.location.pathname;
                                const targetPathMyData = `${appBasePath}/logged-in-my-data.html`;
                                const loginPath = `${appBasePath}/login.html`;

                                if (currentPath.includes(loginPath)) {
                                    console.log(`AuthManager: Schválený používateľ sa prihlásil. Presmerovávam.`);
                                    window.location.href = targetPathMyData;
                                } 
                                else if (userProfileData.role !== 'admin' && blockedPages.some(page => currentPath.includes(page))) {
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
            console.log("AuthManager: Žiadny používateľ - spúšťam anonymné prihlásenie...");
            // Automatické anonymné prihlásenie
            await autoSignInAnonymously();
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
