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
    onSnapshot,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// 🆕 Import pre App Check
import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";


const ENCRYPTED_PROJECT_ID = [0x0F, 0x0B, 0x37, 0x32, 0x39, 0x35, 0x37, 0x33, 0x2C, 0x3F, 0x39, 0x35, 0x32, 0x31, 0x33, 0x24, 0x32, 0x36, 0x7A];
const ENCRYPTED_API_KEY = [0x1B, 0x2E, 0x3D, 0x2C, 0x3B, 0x3C, 0x25, 0x1F, 0x0D, 0x1A, 0x2B, 0x2F, 0x3A, 0x2E, 0x3C, 0x3D, 0x2C, 0x3B, 0x3C, 0x25, 0x2D, 0x3E, 0x2F, 0x2C, 0x3D, 0x2E, 0x3C, 0x0D, 0x1A, 0x2B, 0x2F, 0x3A, 0x2E, 0x3C, 0x3D, 0x2C, 0x3B, 0x3C, 0x25, 0x2D, 0x3E, 0x0D];
const ENCRYPTED_MESSAGING_SENDER_ID = [0x6F, 0x7E, 0x6D, 0x7C, 0x6B, 0x7A, 0x6F, 0x7E, 0x6D, 0x7C, 0x6B, 0x7A];
const ENCRYPTED_APP_ID = [0x4B, 0x3A, 0x6F, 0x7E, 0x6D, 0x7C, 0x6B, 0x7A, 0x6F, 0x7E, 0x6D, 0x7C, 0x6B, 0x7A, 0x3A, 0x6E, 0x7F, 0x6C, 0x3A, 0x6D, 0x7E, 0x6F, 0x7A, 0x6D, 0x0D, 0x7F, 0x6C, 0x7F, 0x7D, 0x6E, 0x6D, 0x3A, 0x0D, 0x7F, 0x6C, 0x7F, 0x7D, 0x6E, 0x0D, 0x7A, 0x6D, 0x6E, 0x3A, 0x6F, 0x7E, 0x0D, 0x7F, 0x6C, 0x0D];

function decryptValue(encryptedArray) {
    const key = 0x5A;
    let result = '';
    for (let i = 0; i < encryptedArray.length; i++) {
        result += String.fromCharCode(encryptedArray[i] ^ key);
    }
    return result;
}

const DECRYPTED_PROJECT_ID = decryptValue(ENCRYPTED_PROJECT_ID);
const DECRYPTED_API_KEY = decryptValue(ENCRYPTED_API_KEY);
const DECRYPTED_MESSAGING_SENDER_ID = decryptValue(ENCRYPTED_MESSAGING_SENDER_ID);
const DECRYPTED_APP_ID = decryptValue(ENCRYPTED_APP_ID);

const firebaseConfig = {
    apiKey: DECRYPTED_API_KEY,
    authDomain: DECRYPTED_PROJECT_ID + ".firebaseapp.com",
    projectId: DECRYPTED_PROJECT_ID,
    storageBucket: DECRYPTED_PROJECT_ID + ".appspot.com",
    messagingSenderId: DECRYPTED_MESSAGING_SENDER_ID,
    appId: DECRYPTED_APP_ID
};

const APP_CHECK_SITE_KEY = "6Lc5mPAsAAAAAJhSEytDinjEsUNn8q1A3DeaZc6x";

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const getAppBasePath = () => {
    const appYearMatch = appId.match(/(\d{4})/);
    const appYear = appYearMatch ? appYearMatch[1] : '2025';
    return `/${appYear}`;
};

const appBasePath = getAppBasePath();

// Definícia verejných stránok (prístupné pre neprihlásených používateľov)
// Prihlásení používatelia majú prístup ku všetkým stránkam
const publicPages = [
    'account.html',
    'admin-register.html',
    'index.html',
    'login.html',
    'register.html',
    'volunteer-register.html',
    'teams-in-groups.html',  // Verejná verzia - prístupná neprihláseným keď je povolená
    'matches.html',         // Verejná verzia - prístupná neprihláseným keď je povolená
    'map.html'              // Mapa je v publicPages - umožňuje prístup neprihláseným keď je povolená
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
        'logged-in-catering.html',
        'logged-in-my-data.html',
        'logged-in-notifications.html',
        'logged-in-rosters.html',
        'logged-in-teams-in-accommodation.html',
        'logged-in-teams-in-groups.html',  // Administrátor má prístup
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
let appCheck;

// Cache pre nastavenia viditeľnosti stránok
let pageVisibilityCache = null;
let pageVisibilityCacheTime = null;
const PAGE_VISIBILITY_CACHE_TTL = 60000; // 1 minúta

let pageVisibilityUnsubscribe = null;
let currentPageVisibilityListenerActive = false;

const isReallyLoggedIn = () => {
    if (!window.globalUserProfileData) return false;
    if (window.isAnonymousUser === true) return false;
    if (window.globalUserProfileData.role === 'anonymous') return false;
    return true;
};

const isAppCheckSupported = () => {
    try {
        return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    } catch (e) {
        return false;
    }
};

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        window.appCheck = appCheck;

        window.dispatchEvent(new CustomEvent('dbInitialized'));
        
    } catch (e) {
    }
};

// 🆕 Funkcia na načítanie nastavení viditeľnosti stránok z Firestore
const loadPageVisibilitySettings = async () => {
    if (!db) return null;
    
    // Kontrola cache
    const now = Date.now();
    if (pageVisibilityCache && pageVisibilityCacheTime && (now - pageVisibilityCacheTime) < PAGE_VISIBILITY_CACHE_TTL) {
        return pageVisibilityCache;
    }
    
    try {
        const pagesRef = collection(db, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);
        
        const visibilitySettings = {};
        pagesSnapshot.forEach(doc => {
            const data = doc.data();
            // Uložíme len stránky, ktoré majú visible = false (skryté)
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
            }
        });
        
        // Aktualizujeme cache
        pageVisibilityCache = visibilitySettings;
        pageVisibilityCacheTime = now;
        
        return visibilitySettings;
    } catch (error) {
        return null;
    }
};

// 🆕 Funkcia na nastavenie real-time listenera pre zmeny viditeľnosti stránok
const setupPageVisibilityListener = () => {
    if (!db) {
        return;
    }
    
    // Zrušíme predchádzajúci listener ak existuje
    if (pageVisibilityUnsubscribe) {
        pageVisibilityUnsubscribe();
        pageVisibilityUnsubscribe = null;
        currentPageVisibilityListenerActive = false;
    }    
    
    const pagesRef = collection(db, 'pages');
    
    pageVisibilityUnsubscribe = onSnapshot(pagesRef, (snapshot) => {        
        // Aktualizujeme cache
        const visibilitySettings = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
            }
        });
        
        // Aktualizujeme cache
        pageVisibilityCache = visibilitySettings;
        pageVisibilityCacheTime = Date.now();        
        
        // SKONTROLUJEME ČI JE AKTUÁLNA STRÁNKA OVPLYVNENÁ ZMENOU
        checkCurrentPageVisibility();
        
    }, (error) => {
    });
    
    currentPageVisibilityListenerActive = true;
};

// 🆕 Funkcia na kontrolu viditeľnosti aktuálnej stránky a prípadné presmerovanie
const checkCurrentPageVisibility = async () => {
    // Ak to nie je HTML stránka, nič nerobíme
    if (!isHtmlPage()) {
        return;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    
    // Ak sme na index.html, vždy necháme - je to vstupná stránka
    if (fileName === 'index.html') {
        return;
    }
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE MAPU: Ak je používateľ prihlásený, má prístup vždy
    if (fileName === 'map.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE MATCHES: Ak je používateľ prihlásený, má prístup vždy
    if (fileName === 'matches.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE TEAMS-IN-GROUPS: Ak je používateľ prihlásený, má prístup vždy
    if (fileName === 'teams-in-groups.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // Získame aktuálne nastavenia (použijeme cache)
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        // Ak sa nepodarilo načítať nastavenia, predpokladáme že stránka je verejná
        return;
    }
    
    // Odstránime .html z názvu pre vyhľadávanie v databáze
    const pageId = fileName.replace('.html', '');
    
    // Kontrola, či je stránka v nastaveniach
    if (settings[pageId] === undefined) {
        // Stránka nie je v nastaveniach - považujeme za verejnú
        return;
    }
    
    const isVisible = settings[pageId];
    
    // AK JE STRÁNKA SKRYTÁ (visible = false)
    if (!isVisible) {        
        // Kontrola či nie sme prihlásený (ak sme, môžeme mať prístup aj k skrytým stránkam)
        const user = auth.currentUser;
        if (user) {
            // Prihlásený používateľ - kontrolujeme či má právo na túto stránku
            const userProfileData = window.globalUserProfileData;
            if (userProfileData && userProfileData.role && hasAccessToPage(userProfileData.role, fileName)) {
                return;
            }
            
            // 🆕 ŠPECIÁLNE PRAVIDLO PRE MAPU: Ak je prihlásený, má prístup aj keď je skrytá
            if (fileName === 'map.html') {
                return;
            }
            
            // 🆕 ŠPECIÁLNE PRAVIDLO PRE MATCHES: Ak je prihlásený, má prístup aj keď je skrytá
            if (fileName === 'matches.html') {
                return;
            }
            
            // 🆕 ŠPECIÁLNE PRAVIDLO PRE TEAMS-IN-GROUPS: Ak je prihlásený, má prístup aj keď je skrytá
            if (fileName === 'teams-in-groups.html') {
                return;
            }
        }
        
        // Presmerujeme na index.html
        const indexUrl = `${appBasePath}/index.html`;
        window.location.href = indexUrl;
    }
};

// 🆕 Funkcia na kontrolu, či je stránka verejná podľa nastavení v databáze
const isPageVisibleInSettings = async (pageId) => {
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        // Ak sa nepodarilo načítať nastavenia, predpokladáme že stránka je verejná (bezpečnostný predvolený stav)
        return true;
    }
    
    // Ak stránka nie je v nastaveniach, predpokladáme že je verejná
    if (settings[pageId] === undefined) {
        return true;
    }
    
    const isVisible = settings[pageId];
    return isVisible;
};

// 🆕 Pomocná funkcia na kontrolu, či je stránka HTML stránka (obsahuje .html)
const isHtmlPage = () => {
    const currentPath = window.location.pathname;
    return currentPath.includes('.html');
};

// 🆕 Pomocná funkcia na získanie názvu súboru z cesty (len ak obsahuje .html)
const getFileNameFromPath = (path) => {
    // Ak cesta neobsahuje .html, vrátime prázdny reťazec
    if (!path.includes('.html')) {
        return '';
    }
    const parts = path.split('/');
    return parts[parts.length - 1];
};

// Pomocná funkcia na kontrolu, či je stránka verejná (prístupná pre neprihlásených)
const isPublicPage = () => {
    // Ak to nie je HTML stránka, považujeme ju za verejnú (napr. root cesta)
    if (!isHtmlPage()) {
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = publicPages.includes(fileName);
    return result;
};

// 🆕 UPRAVENÁ FUNKCIA: Kontrola, či je stránka prístupná pre neprihláseného používateľa
// Berie do úvahy nastavenia viditeľnosti z databázy
const isPageAccessibleForGuest = async () => {
    // Ak to nie je HTML stránka, je vždy prístupná
    if (!isHtmlPage()) {
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE MAPU: Mapa je vždy prístupná pre prihlásených
    if (fileName === 'map.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE MATCHES: Matches je vždy prístupná pre prihlásených
    if (fileName === 'matches.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // 🆕 ŠPECIÁLNE PRAVIDLO PRE TEAMS-IN-GROUPS: Teams-in-groups je vždy prístupná pre prihlásených
    if (fileName === 'teams-in-groups.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        // Ak nie je prihlásený, pokračujeme v kontrole nastavení
    }
    
    // Ak stránka nie je v zozname publicPages, nie je prístupná
    if (!publicPages.includes(fileName)) {
        return false;
    }
    
    // Ak je to index.html, vždy je prístupná
    if (fileName === 'index.html') {
        return true;
    }
    
    // Skontrolujeme nastavenia viditeľnosti z databázy
    // Odstránime .html z názvu pre vyhľadávanie v databáze
    const pageId = fileName.replace('.html', '');
    const isVisible = await isPageVisibleInSettings(pageId);
    
    if (!isVisible) {
        return false;
    }
    
    return true;
};

// Pomocná funkcia na kontrolu, či je stránka dostupná LEN pre neprihlásených používateľov
const isGuestOnlyPage = () => {
    // Ak to nie je HTML stránka, nie je to guest-only stránka
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = guestOnlyPages.includes(fileName);
    return result;
};

// Pomocná funkcia na kontrolu, či sme na login stránke
const isOnLoginPage = () => {
    // Ak to nie je HTML stránka, nie je to login stránka
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = fileName === 'login.html';
    return result;
};

const isOnRegistrationPage = () => {
    // Ak to nie je HTML stránka, nie je to registračná stránka
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const registrationPages = ['register.html', 'admin-register.html', 'volunteer-register.html'];
    const result = registrationPages.includes(fileName);
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
        return false;
    }
    
    const allowedPages = roleAccess[userRole];
    const hasAccess = allowedPages.includes(currentPage);
    
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
        return;
    }
    
    // Konverzia registrationDate na timestamp v milisekundách
    let registrationTimestamp;
    if (userProfileData.registrationDate.seconds) {
        registrationTimestamp = userProfileData.registrationDate.seconds * 1000;
    } else if (typeof userProfileData.registrationDate === 'number') {
        registrationTimestamp = userProfileData.registrationDate;
    } else {
        return;
    }
    
    const currentTime = Date.now();
    const expiryTime = registrationTimestamp + 20000; // +20 sekúnd
    const timeUntilExpiry = expiryTime - currentTime;    
    
    if (timeUntilExpiry > 0) {
        // Aktuálny čas je menší ako registrationDate + 30 sekúnd
        // Používateľ OSTÁVA na stránke a po uplynutí času sa odhlási
        registrationLogoutTimeout = setTimeout(async () => {
            try {
                await signOut(auth);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                window.location.href = `${appBasePath}/login.html?status=registration_expired`;
            } catch (error) {
                window.location.href = `${appBasePath}/login.html`;
            }
        }, timeUntilExpiry);
    } else {        
        if (isOnRegistrationPage()) {
            const targetPath = `${appBasePath}/logged-in-my-data.html`;
            window.location.href = targetPath;
        }
    }
};

// 🆕 UPRAVENÁ FUNKCIA: Spracovanie stavu autentifikácie
const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {            
            // Správna cesta k profilovému dokumentu
            const userDocRef = doc(db, `users/${user.uid}`);
            
            const loadUserProfileData = async (retries = 0) => {
                const MAX_RETRIES = 5; // Zvýšené na 5 pokusov
                const RETRY_DELAY = 200;
            
                try {
                    const docSnap = await getDoc(userDocRef);
            
                    if (!docSnap.exists()) {
                        // Skúsime znova, ak ešte nemáme maximálny počet pokusov
                        if (retries < MAX_RETRIES) {
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            return loadUserProfileData(retries + 1);
                        } else {                            
                            try {
                                await signOut(auth);
                                window.globalUserProfileData = null;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                
                                window.location.href = `${appBasePath}/login.html?status=profile_not_found`;
                            } catch (signOutError) {
                                window.location.href = `${appBasePath}/login.html?status=error`;
                            }
                            return;
                        }
                    }
            
                    // Ak dokument existuje, pokračujeme normálne
                    if (window.unsubscribeUserDoc) {
                        window.unsubscribeUserDoc();
                    }
            
                    window.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const userProfileData = { id: snapshot.id, ...snapshot.data() };
                            
                            // Ak prebieha registrácia admina
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                
                                // Spustíme kontrolu časovača registrácie
                                checkRegistrationTimer(userProfileData);
                                return;
                            }
            
                            // Neschválený administrátor
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
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
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                // 🆕 ŠPECIÁLNE PRAVIDLO PRE MAPU: Prihlásený používateľ má vždy prístup na mapu
                                if (currentPage === 'map.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                    
                                // 🆕 ŠPECIÁLNE PRAVIDLO PRE MATCHES: Prihlásený používateľ má vždy prístup na matches
                                if (currentPage === 'matches.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                // 🆕 ŠPECIÁLNE PRAVIDLO PRE TEAMS-IN-GROUPS: Prihlásený používateľ má vždy prístup na teams-in-groups
                                if (currentPage === 'teams-in-groups.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                // PRE VŠETKY OSTATNÉ STRÁNKY (nie registračné, nie mapa, nie teams-in-groups):
                                // PRIHLÁSENÝ POUŽÍVATEĽ MÁ PRÍSTUP KU VŠETKÝM STRÁNKAM
                                // Iba výnimka: ak je na stránke, ktorá je len pre neprihlásených (guest only)
                                if (isCurrentPageGuestOnly) {
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                // Ak je na login stránke, presmeruj na my-data
                                if (isOnLoginPage()) {
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                // Pre neverejné stránky kontrolujeme prístup podľa roly (len ak ide o HTML stránku)
                                if (isHtmlPage() && !isCurrentPagePublic && !hasAccessToPage(userRole, currentPage)) {
                                    window.location.href = targetPathMyData;
                                    return;
                                }                                
                            }
            
                            window.globalUserProfileData = userProfileData;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                        } else {
                            window.globalUserProfileData = null;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                        }
                    }, (error) => {
                        window.globalUserProfileData = null;
                        window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                    });
                } catch (error) {
                    window.globalUserProfileData = null;
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                }
            };

            loadUserProfileData();

        } else {
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
            // Zrušíme timeout ak existuje
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
                registrationLogoutTimeout = null;
            }
            
            // NEPRIHLÁSENÝ POUŽÍVATEĽ - má prístup LEN k verejným stránkam
            // Ak aktuálna cesta nie je HTML stránka (napr. root), necháme ho tam
            if (!isHtmlPage()) {
                return;
            }
            
            const currentFileName = getFileNameFromPath(window.location.pathname);
            
            const isAccessible = await isPageAccessibleForGuest();            
            
            // Ak stránka nie je prístupná pre neprihlásených, presmerujeme na index.html
            if (!isAccessible) {
                const indexUrl = `${appBasePath}/index.html`;
                window.location.href = indexUrl;
                return;
            }
            
            // Ak je stránka v zozname guestOnlyPages, necháme ho tam (to sú stránky ako login, register)
            if (isGuestOnlyPage()) {
                return;
            }            
        }

        window.addEventListener('beforeunload', () => {
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
            }
            if (pageVisibilityUnsubscribe) {
                pageVisibilityUnsubscribe();
                pageVisibilityUnsubscribe = null;
                currentPageVisibilityListenerActive = false;
            }
        });
    });
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
    
    // 🆕 Po dokončení inicializácie nastavíme real-time listener pre viditeľnosť stránok
    // Počkáme kým sa načíta Firebase a potom nastavíme listener
    const checkAndSetupListener = () => {
        if (db && auth) {
            setupPageVisibilityListener();
        } else {
            setTimeout(checkAndSetupListener, 500);
        }
    };
    
    // Spustíme kontrolu po krátkom čase, aby sme mali istotu že Firebase je inicializovaný
    setTimeout(checkAndSetupListener, 1000);
});
