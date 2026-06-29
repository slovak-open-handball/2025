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
    where,
    limit
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

// 🔒 KONTROLA DOMÉNY - Povolené domény pre prístup
const ALLOWED_DOMAINS = [
    'soh2025-2s0o2h5.github.io',  // GitHub Pages doména
    'localhost',                   // Lokálny vývoj
    '127.0.0.1'                   // Lokálny vývoj
];

// Funkcia na kontrolu, či je aktuálna doména povolená
const isAllowedDomain = () => {
    const hostname = window.location.hostname;
    const isAllowed = ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
    
    if (!isAllowed) {
        console.warn(`🔒 Prístup zamietnutý: Doména "${hostname}" nie je v zozname povolených domén.`);
    } else {
        console.log(`✅ Doména "${hostname}" je povolená.`);
    }
    
    return isAllowed;
};

// 🔒 Funkcia na získanie GitHub Pages tokenu (ak existuje)
const getGitHubAccessToken = () => {
    // Môžeme použiť localStorage pre dočasné uloženie tokenu
    // Token by mal byť nastavený pri prihlásení z GitHub stránky
    return localStorage.getItem('github_access_token') || null;
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

// Cache pre nastavenia viditeľnosti stránok
let pageVisibilityCache = null;
let pageVisibilityCacheTime = null;
const PAGE_VISIBILITY_CACHE_TTL = 60000; // 1 minúta

// 🔒 Funkcia na kontrolu GitHub prístupu cez custom claim
const checkGitHubAccess = async (user) => {
    if (!user) return false;
    
    try {
        // Získame ID token a overíme custom claim
        const idTokenResult = await user.getIdTokenResult();
        const hasGitHubAccess = idTokenResult.claims.githubAccess === true;
        
        console.log(`🔒 GitHub access check: ${hasGitHubAccess ? '✅ POVOLENÝ' : '❌ ZAMIETNUTÝ'}`);
        return hasGitHubAccess;
    } catch (error) {
        console.error('Chyba pri kontrole GitHub prístupu:', error);
        return false;
    }
};

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
        
        // 🔒 Pridáme funkciu na kontrolu domény
        window.isAllowedDomain = isAllowedDomain;
        
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

// Funkcia na načítanie nastavení viditeľnosti stránok z Firestore
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

// Funkcia na kontrolu, či je stránka verejná podľa nastavení v databáze
const isPageVisibleInSettings = async (pageId) => {
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        console.log(`AuthManager: Nepodarilo sa načítať nastavenia, stránka "${pageId}" sa považuje za verejnú.`);
        return true;
    }
    
    if (settings[pageId] === undefined) {
        console.log(`AuthManager: Stránka "${pageId}" nie je v nastaveniach, považuje sa za verejnú.`);
        return true;
    }
    
    const isVisible = settings[pageId];
    console.log(`AuthManager: Stránka "${pageId}" je ${isVisible ? 'verejná' : 'skrytá'} podľa nastavení.`);
    return isVisible;
};

// Pomocná funkcia na kontrolu, či je stránka HTML stránka (obsahuje .html)
const isHtmlPage = () => {
    const currentPath = window.location.pathname;
    return currentPath.includes('.html');
};

// Pomocná funkcia na získanie názvu súboru z cesty (len ak obsahuje .html)
const getFileNameFromPath = (path) => {
    if (!path.includes('.html')) {
        return '';
    }
    const parts = path.split('/');
    return parts[parts.length - 1];
};

// Pomocná funkcia na kontrolu, či je stránka verejná (prístupná pre neprihlásených)
const isPublicPage = () => {
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

// Kontrola, či je stránka prístupná pre neprihláseného používateľa
const isPageAccessibleForGuest = async () => {
    if (!isHtmlPage()) {
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    
    if (!publicPages.includes(fileName)) {
        console.log(`AuthManager: Stránka "${fileName}" nie je v zozname verejných stránok.`);
        return false;
    }
    
    if (fileName === 'index.html') {
        return true;
    }
    
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
    if (registrationLogoutTimeout) {
        clearTimeout(registrationLogoutTimeout);
        registrationLogoutTimeout = null;
    }
    
    if (!isOnRegistrationPage()) {
        return;
    }
    
    if (!userProfileData || !userProfileData.registrationDate) {
        console.log("AuthManager: Chýba registrationDate v profile používateľa.");
        return;
    }
    
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
    const expiryTime = registrationTimestamp + 20000;
    const timeUntilExpiry = expiryTime - currentTime;
    
    console.log(`AuthManager: Kontrola časovača registrácie - zostáva: ${timeUntilExpiry}ms`);
    
    if (timeUntilExpiry > 0) {
        registrationLogoutTimeout = setTimeout(async () => {
            console.log("AuthManager: Uplynul čas 20 sekúnd od registrácie, odhlasujem používateľa.");
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
        console.log("AuthManager: Čas 20 sekúnd od registrácie už uplynul, presmerúvam na logged-in-my-data.html");
        
        if (isOnRegistrationPage()) {
            const targetPath = `${appBasePath}/logged-in-my-data.html`;
            console.log(`AuthManager: Presmerúvam na ${targetPath}`);
            window.location.href = targetPath;
        }
    }
};

// 🔒 HLAVNÁ FUNKCIA SPRACOVANIA AUTENTIFIKÁCIE S KONTROLOU DOMÉNY
const handleAuthState = async () => {
    // 🔒 Najprv skontrolujeme, či je doména povolená
    if (!isAllowedDomain()) {
        console.error("🔒 PRÍSTUP ZAMIETNUTÝ: Neplatná doména!");
        document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                <div>
                    <h1 style="color: #d32f2f;">🚫 Prístup zamietnutý</h1>
                    <p style="font-size: 18px; color: #555;">Táto aplikácia je prístupná iba z povolených domén.</p>
                    <p style="font-size: 14px; color: #888;">Aktuálna doména: <strong>${window.location.hostname}</strong></p>
                    <p style="font-size: 14px; color: #888;">Povolené domény: ${ALLOWED_DOMAINS.join(', ')}</p>
                </div>
            </div>
        `;
        return;
    }
    
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            
            // 🔒 Kontrola GitHub prístupu cez custom claim
            const hasGitHubAccess = await checkGitHubAccess(user);
            
            if (!hasGitHubAccess) {
                console.warn("🔒 Používateľ nemá GitHub prístup. Odhlasujem...");
                await signOut(auth);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                window.location.href = `${appBasePath}/login.html?status=access_denied`;
                return;
            }
            
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
                            
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                console.log("AuthManager: Prebieha registrácia administrátora.");
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                checkRegistrationTimer(userProfileData);
                                return;
                            }

                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
                                console.warn("AuthManager: Nepovolený administrátor detekovaný.");
                                signOut(auth).then(() => {
                                    window.globalUserProfileData = null;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                    window.location.href = `${appBasePath}/login.html?status=unapproved_admin`; 
                                });
                                return;
                            } 
                            
                            else if (userProfileData.approved === true) {
                                const targetPathMyData = `${appBasePath}/logged-in-my-data.html`;
                                const currentPage = getFileNameFromPath(window.location.pathname);
                                const userRole = userProfileData.role;
                                const isCurrentPagePublic = isPublicPage();
                                const isCurrentPageGuestOnly = isGuestOnlyPage();
                                const isOnRegPage = isOnRegistrationPage();
                                
                                checkRegistrationTimer(userProfileData);
                                
                                if (isOnRegPage) {
                                    console.log(`AuthManager: Prihlásený používateľ na registračnej stránke "${currentPage}". Žiadne presmerovanie (časovač je spustený).`);
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                if (isCurrentPageGuestOnly) {
                                    console.log(`AuthManager: Prihlásený používateľ na stránke určenej len pre neprihlásených ("${currentPage}"). Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                if (isOnLoginPage()) {
                                    console.log(`AuthManager: Prihlásený používateľ na login stránke. Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                if (isHtmlPage() && !isCurrentPagePublic && !hasAccessToPage(userRole, currentPage)) {
                                    console.log(`AuthManager: Používateľ s rolou "${userRole}" nemá prístup na stránku "${currentPage}". Presmerovávam na ${targetPathMyData}`);
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
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
            
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
                registrationLogoutTimeout = null;
            }
            
            if (!isHtmlPage()) {
                console.log(`AuthManager: Neprihlásený používateľ na ne-HTML stránke "${window.location.pathname}". Žiadne presmerovanie.`);
                return;
            }
            
            const currentFileName = getFileNameFromPath(window.location.pathname);
            const isAccessible = await isPageAccessibleForGuest();
            
            console.log(`AuthManager: Neprihlásený používateľ na stránke "${currentFileName}". Je prístupná? ${isAccessible}`);
            
            if (!isAccessible) {
                console.log(`AuthManager: Neprihlásený používateľ na skrytej stránke "${currentFileName}". Presmerovávam na index.html.`);
                const indexUrl = `${appBasePath}/index.html`;
                console.log(`AuthManager: Presmerúvam na: ${indexUrl}`);
                window.location.href = indexUrl;
                return;
            }
            
            if (isGuestOnlyPage()) {
                console.log(`AuthManager: Neprihlásený používateľ na guest-only stránke "${currentFileName}". Žiadne presmerovanie.`);
                return;
            }
            
            console.log(`AuthManager: Neprihlásený používateľ na verejnej stránke "${currentFileName}". Žiadne presmerovanie.`);
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
