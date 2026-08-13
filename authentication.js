// authentication.js
// Tento súbor spravuje globálnu autentifikáciu, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.
// 🔥 VŠETKY FIREBASE OPERÁCIE IDÚ CEZ CLOUDFLARE WORKER

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

// 🔥 KONFIGURÁCIA CLOUDFLARE WORKERA
// Všetky požiadavky na Firebase idú cez tento Worker
const WORKER_URL = 'https://worker.miloslav-mihucky.workers.dev';

// 🔥 Firebase Client SDK (POUZE PRE PRIHLASOVANIE - žiadne databázové operácie!)
// Tieto kľúče sú verejné a slúžia len na autentifikáciu používateľov
// Všetky databázové operácie idú cez Worker
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
// ❌ NEIMPORTUJEME firestore - všetko ide cez Worker!

// 🔥 Firebase konfigurácia (LEN PRE AUTENTIFIKÁCIU)
// Tieto údaje sú bezpečné, pretože:
// 1. Slúžia IBA na prihlasovanie
// 2. Žiadne databázové operácie sa nevykonávajú priamo
// 3. Všetky citlivé operácie idú cez Worker s overením tokenu
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "367316414164",
    appId: "1:367316414164:web:fce079e1c7f4223292490b"
};

// Inicializácia Firebase (LEN PRE AUTENTIFIKÁCIU)
let app;
let auth;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    console.log("✅ AuthManager: Firebase Auth inicializovaný.");
    console.log(`📡 Worker URL: ${WORKER_URL}`);

    window.auth = auth;
    window.reauthenticateWithCredential = reauthenticateWithCredential;
    window.updateEmail = updateEmail;
    window.EmailAuthProvider = EmailAuthProvider;
    window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
    
    // ❌ NENASTAVUJEME window.db - všetko ide cez Worker!
    window.db = null;
    
    window.dispatchEvent(new CustomEvent('dbInitialized'));
    
} catch (e) {
    console.error("❌ AuthManager: Chyba pri inicializácii Firebase Auth:", e);
}

// 📡 VOLANIE WORKERA - VŠETKY DATABÁZOVÉ OPERÁCIE
const callWorker = async (endpoint, options = {}) => {
    const url = `${WORKER_URL}${endpoint}`;
    
    // Získanie Firebase tokenu ak je používateľ prihlásený
    let token = null;
    if (auth && auth.currentUser) {
        try {
            token = await auth.currentUser.getIdToken();
        } catch (e) {
            console.warn('AuthManager: Nepodarilo sa získať token:', e);
        }
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Neznáma chyba' }));
        throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
};

// 📥 NAČÍTANIE PROFILU POUŽÍVATEĽA CEZ WORKER
const loadUserProfileData = async (uid) => {
    try {
        if (!uid) {
            console.warn('AuthManager: loadUserProfileData - Chýba UID');
            return null;
        }
        
        console.log(`📥 AuthManager: Načítavam profil používateľa: ${uid}`);
        const data = await callWorker(`/api/user/${uid}`);
        return data;
    } catch (error) {
        console.error('❌ AuthManager: Chyba pri načítaní profilu:', error);
        return null;
    }
};

// 📤 AKTUALIZÁCIA PROFILU CEZ WORKER
const updateUserProfile = async (data) => {
    try {
        console.log('📤 AuthManager: Aktualizujem profil');
        const result = await callWorker('/api/user/update', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        return result;
    } catch (error) {
        console.error('❌ AuthManager: Chyba pri aktualizácii profilu:', error);
        throw error;
    }
};

// 🗺️ NAČÍTANIE NASTAVENÍ VIDITEĽNOSTI STRÁNOK CEZ WORKER
const loadPageVisibilitySettings = async () => {
    try {
        console.log('📥 AuthManager: Načítavam nastavenia stránok');
        const data = await callWorker('/api/pages');
        return data;
    } catch (error) {
        console.warn('⚠️ AuthManager: Chyba pri načítaní nastavení stránok:', error);
        return null;
    }
};

// 📧 ODOSLANIE EMAILU CEZ WORKER
const sendEmail = async (emailData) => {
    try {
        console.log('📧 AuthManager: Odosielam email');
        const result = await callWorker('/api/send-email', {
            method: 'POST',
            body: JSON.stringify(emailData),
        });
        return result;
    } catch (error) {
        console.error('❌ AuthManager: Chyba pri odosielaní emailu:', error);
        throw error;
    }
};

// 🔄 POMOCNÉ FUNKCIE (BEZ ZMENY)
const getAppBasePath = () => {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const appYearMatch = appId.match(/(\d{4})/);
    const appYear = appYearMatch ? appYearMatch[1] : '2025';
    return `/${appYear}`;
};

const appBasePath = getAppBasePath();

// Definícia verejných stránok
const publicPages = [
    'account.html',
    'admin-register.html',
    'index.html',
    'login.html',
    'register.html',
    'volunteer-register.html',
    'teams-in-groups.html',
    'matches.html',
    'map.html'
];

// Definícia stránok dostupných LEN pre neprihlásených
const guestOnlyPages = [
    'login.html',
    'register.html',
    'admin-register.html',
    'volunteer-register.html'
];

// Definícia prístupových práv pre jednotlivé roly
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

// 🔄 POMOCNÉ FUNKCIE PRE KONTROLU STRÁNOK
const isHtmlPage = () => window.location.pathname.includes('.html');
const getFileNameFromPath = (path) => {
    if (!path.includes('.html')) return '';
    const parts = path.split('/');
    return parts[parts.length - 1];
};
const isOnLoginPage = () => getFileNameFromPath(window.location.pathname) === 'login.html';
const isOnRegistrationPage = () => {
    const fileName = getFileNameFromPath(window.location.pathname);
    return ['register.html', 'admin-register.html', 'volunteer-register.html'].includes(fileName);
};
const isPublicPage = () => {
    return publicPages.includes(getFileNameFromPath(window.location.pathname));
};
const isGuestOnlyPage = () => {
    return guestOnlyPages.includes(getFileNameFromPath(window.location.pathname));
};
const hasAccessToPage = (userRole, currentPage) => {
    if (!userRole || !currentPage) return false;
    if (!roleAccess[userRole]) return false;
    return roleAccess[userRole].includes(currentPage);
};

// 🔄 SPRACOVANIE STAVU AUTENTIFIKÁCIE
let registrationLogoutTimeout = null;

const checkRegistrationTimer = (userProfileData) => {
    if (registrationLogoutTimeout) {
        clearTimeout(registrationLogoutTimeout);
        registrationLogoutTimeout = null;
    }
    
    if (!isOnRegistrationPage()) return;
    if (!userProfileData || !userProfileData.registrationDate) {
        console.log("AuthManager: Chýba registrationDate v profile.");
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
    
    if (timeUntilExpiry > 0) {
        registrationLogoutTimeout = setTimeout(async () => {
            console.log("AuthManager: Uplynul čas 30 sekúnd od registrácie, odhlasujem používateľa.");
            try {
                await signOut(auth);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                window.location.href = `${appBasePath}/login.html?status=registration_expired`;
            } catch (error) {
                console.error("AuthManager: Chyba pri odhlasovaní:", error);
                window.location.href = `${appBasePath}/login.html`;
            }
        }, timeUntilExpiry);
    } else {
        if (isOnRegistrationPage()) {
            const targetPath = `${appBasePath}/logged-in-my-data.html`;
            console.log(`AuthManager: Presmerúvam na ${targetPath}`);
            window.location.href = targetPath;
        }
    }
};

// 🔄 HLAVNÁ FUNKCIA SPRACOVANIA AUTENTIFIKÁCIE
const handleAuthState = () => {
    if (!auth) {
        console.error('❌ AuthManager: Auth nie je inicializovaný');
        return;
    }
    
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log(`✅ AuthManager: Používateľ prihlásený: ${user.uid} (${user.email})`);
            
            // 📥 NAČÍTANIE PROFILU CEZ WORKER
            const userProfileData = await loadUserProfileData(user.uid);
            
            if (userProfileData) {
                console.log('📦 AuthManager: Profil načítaný:', userProfileData);
                window.globalUserProfileData = userProfileData;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                
                // 🔄 KONTROLA PRESMEROVANIA
                const currentPage = getFileNameFromPath(window.location.pathname);
                const isOnRegPage = isOnRegistrationPage();
                const isCurrentPageGuestOnly = isGuestOnlyPage();
                const isCurrentPagePublic = isPublicPage();
                const userRole = userProfileData.role;
                const targetPathMyData = `${appBasePath}/logged-in-my-data.html`;
                
                // Kontrola registračného časovača
                checkRegistrationTimer(userProfileData);
                
                // Ak sme na registračnej stránke, necháme používateľa
                if (isOnRegPage) {
                    console.log(`📝 AuthManager: Používateľ na registračnej stránke - žiadne presmerovanie`);
                    return;
                }
                
                // Ak je na guest-only stránke, presmerujeme na my-data
                if (isCurrentPageGuestOnly) {
                    console.log(`🔄 AuthManager: Presmerúvam z guest-only na ${targetPathMyData}`);
                    window.location.href = targetPathMyData;
                    return;
                }
                
                // Ak je na login stránke, presmerujeme na my-data
                if (isOnLoginPage()) {
                    console.log(`🔄 AuthManager: Presmerúvam z login na ${targetPathMyData}`);
                    window.location.href = targetPathMyData;
                    return;
                }
                
                // Pre neverejné stránky kontrolujeme prístup podľa roly
                if (isHtmlPage() && !isCurrentPagePublic && !hasAccessToPage(userRole, currentPage)) {
                    console.log(`🔒 AuthManager: Používateľ s rolou "${userRole}" nemá prístup na "${currentPage}"`);
                    window.location.href = targetPathMyData;
                    return;
                }
                
                console.log(`✅ AuthManager: Používateľ s rolou "${userRole}" má prístup na "${currentPage}"`);
            } else {
                console.warn('⚠️ AuthManager: Nepodarilo sa načítať profil používateľa');
            }
        } else {
            console.log('❌ AuthManager: Žiadny používateľ nie je prihlásený');
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
                registrationLogoutTimeout = null;
            }
            
            // NEPRIHLÁSENÝ POUŽÍVATEĽ
            if (isHtmlPage()) {
                const currentFileName = getFileNameFromPath(window.location.pathname);
                const isPublic = isPublicPage();
                
                // Ak nie je na verejnej stránke, presmerujeme na index
                if (!isPublic) {
                    console.log(`🔄 AuthManager: Presmerúvam na index.html`);
                    window.location.href = `${appBasePath}/index.html`;
                }
            }
        }
    });

    console.log('✅ AuthManager: Auth state listener nastavený');
};

// 🚀 INICIALIZÁCIA
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        handleAuthState();
    });
} else {
    handleAuthState();
}

// 🔧 EXPORT FUNKCIÍ PRE OSTATNÉ SKRIPTY
window.callWorker = callWorker;
window.loadUserProfileData = loadUserProfileData;
window.updateUserProfile = updateUserProfile;
window.loadPageVisibilitySettings = loadPageVisibilitySettings;
window.sendEmail = sendEmail;
window.WORKER_URL = WORKER_URL;

console.log('✅ AuthManager: authentication.js načítaný');
console.log(`📡 AuthManager: Worker URL: ${WORKER_URL}`);
console.log('🔒 AuthManager: Všetky databázové operácie idú cez Worker');
