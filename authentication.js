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

// Vložený konfiguračný objekt
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "367316414164",
    appId: "1:367316414164:web:fce079e1c7f4223292490b"
};

// 🆕 App Check konfigurácia - tvoj identifikačný kľúč (site key) pre reCAPTCHA Enterprise
const APP_CHECK_SITE_KEY = "6Lc5mPAsAAAAAJhSEytDinjEsUNn8q1A3DeaZc6x";

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
    'teams-in-groups.html',
    'matches.html'
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
let appCheck;

// Cache pre nastavenia viditeľnosti stránok
let pageVisibilityCache = null;
let pageVisibilityCacheTime = null;
const PAGE_VISIBILITY_CACHE_TTL = 60000; // 1 minúta

// 🆕 Real-time listener pre zmeny viditeľnosti stránok
let pageVisibilityUnsubscribe = null;
let currentPageVisibilityListenerActive = false;

// 🆕 Pomocná funkcia na kontrolu, či je App Check podporovaný v prehliadači
const isAppCheckSupported = () => {
    try {
        // Kontrola, či je dostupný window a localStorage (pre debug token)
        return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
    } catch (e) {
        console.warn("AuthManager: App Check nie je podporovaný v tomto prostredí:", e);
        return false;
    }
};

// 🆕 Funkcia na nastavenie debug tokenu pre lokálny vývoj
const setupAppCheckDebug = () => {
    // Debug token sa nastavuje len pre lokálny vývoj (localhost)
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname === '';
    
    if (isLocalhost) {
        // Povolenie debug tokenu pre lokálny vývoj
        // Po prvom načítaní sa v konzole zobrazí debug token, ktorý treba zaregistrovať vo Firebase Console
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        console.log("AuthManager: 🔧 App Check debug mód aktivovaný pre localhost. Skontroluj konzolu pre debug token.");
        
        // Upozornenie pre vývojára
        console.log("%c⚠️ App Check Debug Mód aktívny! Nezabudni zaregistrovať debug token vo Firebase Console → App Check → Debug tokens", "color: orange; font-size: 14px;");
    }
};

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // 🆕 Dočasne vypnutý App Check - aktivuj neskôr
        // if (isAppCheckSupported()) {
        //     setupAppCheckDebug();
        //     
        //     appCheck = initializeAppCheck(app, {
        //         provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        //         isTokenAutoRefreshEnabled: true
        //     });
        //     console.log("AuthManager: ✅ Firebase App Check inicializovaný s reCAPTCHA Enterprise.");
        // } else {
        //     console.warn("AuthManager: ⚠️ App Check nie je podporovaný, pokračujem bez neho.");
        // }
        
        console.log("AuthManager: Firebase inicializovaný.");

        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        window.appCheck = appCheck;
        
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// 🆕 Funkcia na načítanie nastavení viditeľnosti stránok z Firestore
const loadPageVisibilitySettings = async () => {
    if (!db) return null;
    
    // Kontrola cache
    const now = Date.now();
    if (pageVisibilityCache && pageVisibilityCacheTime && (now - pageVisibilityCacheTime) < PAGE_VISIBILITY_CACHE_TTL) {
        console.log("AuthManager: Používam cached nastavenia viditeľnosti stránok.");
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
        
        console.log("AuthManager: Načítané nastavenia viditeľnosti stránok:", visibilitySettings);
        return visibilitySettings;
    } catch (error) {
        console.warn("AuthManager: Chyba pri načítaní nastavení viditeľnosti stránok:", error);
        return null;
    }
};

// 🆕 Funkcia na nastavenie real-time listenera pre zmeny viditeľnosti stránok
const setupPageVisibilityListener = () => {
    if (!db) {
        console.warn("AuthManager: Firebase DB nie je inicializovaná, nemožno nastaviť listener.");
        return;
    }
    
    // Zrušíme predchádzajúci listener ak existuje
    if (pageVisibilityUnsubscribe) {
        pageVisibilityUnsubscribe();
        pageVisibilityUnsubscribe = null;
        currentPageVisibilityListenerActive = false;
    }
    
    console.log("AuthManager: Nastavujem real-time listener pre zmeny viditeľnosti stránok...");
    
    const pagesRef = collection(db, 'pages');
    
    pageVisibilityUnsubscribe = onSnapshot(pagesRef, (snapshot) => {
        console.log("AuthManager: Detekovaná zmena v nastaveniach viditeľnosti stránok.");
        
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
        
        console.log("AuthManager: Aktualizované nastavenia viditeľnosti stránok:", visibilitySettings);
        
        // SKONTROLUJEME ČI JE AKTUÁLNA STRÁNKA OVPLYVNENÁ ZMENOU
        checkCurrentPageVisibility();
        
    }, (error) => {
        console.error("AuthManager: Chyba pri real-time listenere pre viditeľnosť stránok:", error);
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
        console.log(`AuthManager: Stránka "${fileName}" bola skrytá v nastaveniach. Presmerovávam na index.html.`);
        
        // Kontrola či nie sme prihlásený (ak sme, môžeme mať prístup aj k skrytým stránkam)
        const user = auth.currentUser;
        if (user) {
            // Prihlásený používateľ - kontrolujeme či má právo na túto stránku
            const userProfileData = window.globalUserProfileData;
            if (userProfileData && userProfileData.role && hasAccessToPage(userProfileData.role, fileName)) {
                console.log(`AuthManager: Prihlásený používateľ s rolou "${userProfileData.role}" má prístup k skrytej stránke "${fileName}". Nechávam ho.`);
                return;
            }
        }
        
        // Presmerujeme na index.html
        const indexUrl = `${appBasePath}/index.html`;
        console.log(`AuthManager: Presmerúvam na: ${indexUrl}`);
        window.location.href = indexUrl;
    }
};

// 🆕 Funkcia na kontrolu, či je stránka verejná podľa nastavení v databáze
const isPageVisibleInSettings = async (pageId) => {
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        // Ak sa nepodarilo načítať nastavenia, predpokladáme že stránka je verejná (bezpečnostný predvolený stav)
        console.log(`AuthManager: Nepodarilo sa načítať nastavenia, stránka "${pageId}" sa považuje za verejnú.`);
        return true;
    }
    
    // Ak stránka nie je v nastaveniach, predpokladáme že je verejná
    if (settings[pageId] === undefined) {
        console.log(`AuthManager: Stránka "${pageId}" nie je v nastaveniach, považuje sa za verejnú.`);
        return true;
    }
    
    const isVisible = settings[pageId];
    console.log(`AuthManager: Stránka "${pageId}" je ${isVisible ? 'verejná' : 'skrytá'} podľa nastavení.`);
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
        console.log(`AuthManager: isPublicPage() - aktuálna cesta "${window.location.pathname}" nie je HTML stránka, považujem za verejnú.`);
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = publicPages.includes(fileName);
    console.log(`AuthManager: isPublicPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
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
    
    // Ak stránka nie je v zozname publicPages, nie je prístupná
    if (!publicPages.includes(fileName)) {
        console.log(`AuthManager: Stránka "${fileName}" nie je v zozname verejných stránok.`);
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
        console.log(`AuthManager: Stránka "${fileName}" je skrytá v nastaveniach, NIE JE prístupná pre neprihlásených.`);
        return false;
    }
    
    console.log(`AuthManager: Stránka "${fileName}" je verejná a prístupná pre neprihlásených.`);
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
    console.log(`AuthManager: isGuestOnlyPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
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
    console.log(`AuthManager: isOnLoginPage() - currentPath: "${currentPath}", fileName: "${fileName}", result: ${result}`);
    return result;
};

// Pomocná funkcia na kontrolu, či sme na jednej z registračných stránok
const isOnRegistrationPage = () => {
    // Ak to nie je HTML stránka, nie je to registračná stránka
    if (!isHtmlPage()) {
        return false;
    }
    
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
    const expiryTime = registrationTimestamp + 20000; // +20 sekúnd
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

// 🆕 UPRAVENÁ FUNKCIA: Spracovanie stavu autentifikácie
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
                                
                                // Pre neverejné stránky kontrolujeme prístup podľa roly (len ak ide o HTML stránku)
                                if (isHtmlPage() && !isCurrentPagePublic && !hasAccessToPage(userRole, currentPage)) {
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
            // Ak aktuálna cesta nie je HTML stránka (napr. root), necháme ho tam
            if (!isHtmlPage()) {
                console.log(`AuthManager: Neprihlásený používateľ na ne-HTML stránke "${window.location.pathname}". Žiadne presmerovanie.`);
                return;
            }
            
            const currentFileName = getFileNameFromPath(window.location.pathname);
            
            // 🆕 KONTROLA: Je stránka prístupná pre neprihlásených podľa nastavení viditeľnosti?
            const isAccessible = await isPageAccessibleForGuest();
            
            console.log(`AuthManager: Neprihlásený používateľ na stránke "${currentFileName}". Je prístupná? ${isAccessible}`);
            
            // Ak stránka nie je prístupná pre neprihlásených, presmerujeme na index.html
            if (!isAccessible) {
                console.log(`AuthManager: Neprihlásený používateľ na skrytej stránke "${currentFileName}". Presmerovávam na index.html.`);
                const indexUrl = `${appBasePath}/index.html`;
                console.log(`AuthManager: Presmerúvam na: ${indexUrl}`);
                window.location.href = indexUrl;
                return;
            }
            
            // Ak je stránka v zozname guestOnlyPages, necháme ho tam (to sú stránky ako login, register)
            if (isGuestOnlyPage()) {
                console.log(`AuthManager: Neprihlásený používateľ na guest-only stránke "${currentFileName}". Žiadne presmerovanie.`);
                return;
            }
            
            // Ak je na verejnej a prístupnej stránke, necháme ho tam
            console.log(`AuthManager: Neprihlásený používateľ na verejnej stránke "${currentFileName}". Žiadne presmerovanie.`);
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

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
    
    // 🆕 Po dokončení inicializácie nastavíme real-time listener pre viditeľnosť stránok
    // Počkáme kým sa načíta Firebase a potom nastavíme listener
    const checkAndSetupListener = () => {
        if (db && auth) {
            console.log("AuthManager: Inicializácia Firebase dokončená, nastavujem listener pre viditeľnosť stránok.");
            setupPageVisibilityListener();
        } else {
            console.log("AuthManager: Čakám na inicializáciu Firebase pred nastavením listenera pre viditeľnosť stránok.");
            setTimeout(checkAndSetupListener, 500);
        }
    };
    
    // Spustíme kontrolu po krátkom čase, aby sme mali istotu že Firebase je inicializovaný
    setTimeout(checkAndSetupListener, 1000);
});
