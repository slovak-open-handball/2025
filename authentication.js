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

// Definícia verejných stránok (prístupné len pre neprihlásených používateľov)
// Prihlásení používatelia majú prístup ku všetkým stránkam
const publicPages = [
    'account.html',
    'admin-register.html',
    'index.html',
    'login.html',
    'register.html',
    'volunteer-register.html',
];

// Definícia stránok dostupných LEN pre neprihlásených používateľov
// (ak je prihlásený používateľ na takejto stránke, bude presmerovaný na my-data)
const guestOnlyPages = [
    'login.html',
    'register.html',
    'admin-register.html',
    'volunteer-register.html'
];

// Definícia prístupových práv pre jednotlivé roly (pre neverejné stránky)
const roleAccess = {
    admin: [
        'logged-in-add-categories.html',
        'logged-in-add-groups.html',
        'logged-in-all-registrations.html',
        'logged-in-map.html',
        'logged-in-matches.html',
        'logged-in-my-data.html',
        'logged-in-notifications.html',
        'logged-in-rosters.html',
        'logged-in-teams-in-accommodation.html',
        'logged-in-teams-in-groups.html',
        'logged-in-template.html',
        'logged-in-tournament-settings.html',
        'logged-in-users.html'
    ],
    hall: [
        'logged-in-my-data.html',
        'logged-in-matches-hall.html'
    ],
    club: [
        'logged-in-my-data.html',
        'logged-in-rosters.html'
    ],
    volunteer: [
        'logged-in-my-data.html'
    ]
};

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

// Pomocná funkcia na získanie názvu súboru z cesty
const getFileNameFromPath = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
};

// Pomocná funkcia na kontrolu, či je stránka verejná (prístupná pre neprihlásených)
const isPublicPage = () => {
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = publicPages.includes(fileName);
    console.log(`AuthManager: isPublicPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či je stránka dostupná LEN pre neprihlásených používateľov
const isGuestOnlyPage = () => {
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = guestOnlyPages.includes(fileName);
    console.log(`AuthManager: isGuestOnlyPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či sme na login stránke
const isOnLoginPage = () => {
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = fileName === 'login.html';
    console.log(`AuthManager: isOnLoginPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či sme na jednej z registračných stránok
const isOnRegistrationPage = () => {
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const registrationPages = ['register.html', 'admin-register.html', 'volunteer-register.html'];
    const result = registrationPages.includes(fileName);
    console.log(`AuthManager: isOnRegistrationPage() - fileName: "${fileName}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či je stránka neverejná (vyžaduje prihlásenie)
const isPrivatePage = () => {
    return !isPublicPage();
};

// Pomocná funkcia na kontrolu, či má používateľ prístup k aktuálnej stránke (podľa roly)
const hasAccessToPage = (userRole, currentPage) => {
    if (!userRole || !currentPage) return false;
    
    // Ak rola nemá definovaný prístup, vráti false
    if (!roleAccess[userRole]) {
        console.log(`AuthManager: Rola "${userRole}" nemá definovaný žiadny prístup.`);
        return false;
    }
    
    const allowedPages = roleAccess[userRole];
    const hasAccess = allowedPages.includes(currentPage);
    
    console.log(`AuthManager: hasAccessToPage() - role: "${userRole}", page: "${currentPage}", hasAccess: ${hasAccess}`);
    return hasAccess;
};

// Premenná pre timeout odhlásenia pri registrácii
let registrationLogoutTimeout = null;

// Funkcia na kontrolu registračného časovača
const checkRegistrationTimer = (userProfileData) => {
    // Zrušíme predchádzajúci timeout ak existuje
    if (registrationLogoutTimeout) {
        clearTimeout(registrationLogoutTimeout);
        registrationLogoutTimeout = null;
    }
    
    // Kontrola či sme na registračnej stránke
    if (!isOnRegistrationPage()) {
        return;
    }
    
    // Kontrola či máme registrationDate v profile
    if (!userProfileData || !userProfileData.registrationDate) {
        console.log("AuthManager: Chýba registrationDate v profile používateľa.");
        return;
    }
    
    // Konverzia registrationDate na timestamp v milisekundách
    let registrationTimestamp;
    if (userProfileData.registrationDate.seconds) {
        registrationTimestamp = userProfileData.registrationDate.seconds * 1000;
    } else if (typeof userProfileData.registrationDate === 'number') {
        registrationTimestamp = userProfileData.registrationDate;
    } else {
        console.log("AuthManager: Neznámy formát registrationDate.");
        return;
    }
    
    const currentTime = Date.now();
    const expiryTime = registrationTimestamp + 30000; // +30 sekúnd
    const timeUntilExpiry = expiryTime - currentTime;
    
    console.log(`AuthManager: Kontrola časovača registrácie - aktuálny čas: ${new Date(currentTime).toLocaleTimeString()}, expirácia: ${new Date(expiryTime).toLocaleTimeString()}, zostáva: ${timeUntilExpiry}ms`);
    
    if (timeUntilExpiry > 0) {
        // Aktuálny čas je menší ako registrationDate + 30 sekúnd
        // Používateľ OSTÁVA na stránke a po uplynutí času sa odhlási
        console.log(`AuthManager: Čas 30 sekúnd ešte neuplynul, používateľ ostáva na stránke. Nastavujem odhlásenie o ${timeUntilExpiry}ms`);
        registrationLogoutTimeout = setTimeout(async () => {
            console.log("AuthManager: Uplynul čas 30 sekúnd od registrácie, odhlasujem používateľa.");
            try {
                await signOut(auth);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                window.location.href = `${appBasePath}/login.html?status=registration_expired`;
            } catch (error) {
                console.error("AuthManager: Chyba pri odhlasovaní po registrácii:", error);
                window.location.href = `${appBasePath}/login.html`;
            }
        }, timeUntilExpiry);
    } else {
        // Aktuálny čas je väčší ako registrationDate + 30 sekúnd
        // Používateľ by mal byť presmerovaný na logged-in-my-data.html
        console.log("AuthManager: Čas 30 sekúnd od registrácie už uplynul, presmerúvam na logged-in-my-data.html");
        
        // Presmerujeme iba ak sme na registračnej stránke
        if (isOnRegistrationPage()) {
            const targetPath = `${appBasePath}/logged-in-my-data.html`;
            console.log(`AuthManager: Presmerúvam na ${targetPath}`);
            window.location.href = targetPath;
        }
    }
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
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            return loadUserProfileData(retries + 1);
                        } else {
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
                                
                                // Spustíme kontrolu časovača registrácie
                                checkRegistrationTimer(userProfileData);
                                return;
                            }

                            // Neschválený administrátor
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
                                console.warn("AuthManager: Nepovolený administrátor detekovaný.");
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
                                const currentPage = getFileNameFromPath(window.location.pathname);
                                const userRole = userProfileData.role;
                                const isCurrentPagePublic = isPublicPage();
                                const isCurrentPageGuestOnly = isGuestOnlyPage();
                                const isOnRegPage = isOnRegistrationPage();
                                
                                // Spustíme kontrolu časovača registrácie (pre prípad že sme na registračnej stránke)
                                // Táto funkcia sa postará o:
                                // - ak čas ešte neuplynul: nastaví timeout na odhlásenie
                                // - ak čas už uplynul: presmeruje na my-data
                                checkRegistrationTimer(userProfileData);
                                
                                // AK SME NA REGISTRAČNEJ STRÁNKE:
                                // Nevykonávame ŽIADNE ďalšie presmerovanie - checkRegistrationTimer už rozhodol
                                if (isOnRegPage) {
                                    console.log(`AuthManager: Prihlásený používateľ na registračnej stránke "${currentPage}". Žiadne presmerovanie (časovač je spustený).`);
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                // PRE VŠETKY OSTATNÉ STRÁNKY (nie registračné):
                                // PRIHLÁSENÝ POUŽÍVATEĽ MÁ PRÍSTUP KU VŠETKÝM STRÁNKAM
                                // Iba výnimka: ak je na stránke, ktorá je len pre neprihlásených (guest only)
                                if (isCurrentPageGuestOnly) {
                                    console.log(`AuthManager: Prihlásený používateľ na stránke určenej len pre neprihlásených ("${currentPage}"). Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                // Ak je na login stránke, presmeruj na my-data
                                if (isOnLoginPage()) {
                                    console.log(`AuthManager: Prihlásený používateľ na login stránke. Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                // Pre neverejné stránky kontrolujeme prístup podľa roly
                                if (!isCurrentPagePublic && !hasAccessToPage(userRole, currentPage)) {
                                    console.log(`AuthManager: Používateľ s rolou "${userRole}" nemá prístup na stránku "${currentPage}". Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                // Inak nechaj používateľa na aktuálnej stránke (má prístup)
                                console.log(`AuthManager: Prihlásený používateľ s rolou "${userRole}" má prístup na stránku "${currentPage}".`);
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
            
            // Zrušíme timeout ak existuje
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
                registrationLogoutTimeout = null;
            }
            
            // NEPRIHLÁSENÝ POUŽÍVATEĽ - má prístup LEN k verejným stránkam
            const isCurrentPagePublic = isPublicPage();
            const currentFileName = getFileNameFromPath(window.location.pathname);
            
            console.log(`AuthManager: Neprihlásený používateľ na stránke "${currentFileName}". Je verejná? ${isCurrentPagePublic}`);
            
            // Ak stránka nie je verejná, presmerujeme na login
            if (!isCurrentPagePublic) {
                console.log("AuthManager: Neprihlásený používateľ na neverejnej stránke. Presmerovávam na login.");
                const loginUrl = `${appBasePath}/login.html`;
                console.log(`AuthManager: Presmerúvam na: ${loginUrl}`);
                window.location.href = loginUrl;
                return;
            }
            
            // Ak je na verejnej stránke, necháme ho tam
            console.log("AuthManager: Neprihlásený používateľ na verejnej stránke. Žiadne presmerovanie.");
        }

        window.addEventListener('beforeunload', () => {
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
