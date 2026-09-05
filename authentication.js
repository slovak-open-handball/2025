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
    verifyBeforeUpdateEmail,
    applyActionCode,
    checkActionCode,
    verifyPasswordResetCode,
    confirmPasswordReset
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
import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";

const ENCRYPTED_CONFIG = "eyJhcGlLZXkiOiJBSXphU3lBaEZ5T3BwaldEWV96a0pjdVdKMkFMcGI1WjFhbFpZeTQiLCJhdXRoRG9tYWluIjoic29oMjAyNS0yczBvMmg1LmZpcmViYXNlYXBwLmNvbSIsInByb2plY3RJZCI6InNvaDIwMjUtMnMwbzJoNSIsInN0b3JhZ2VCdWNrZXQiOiJzb2gyMDI1LTJzMG8yaDUuYXBwc3BvdC5jb20iLCJtZXNzYWdpbmdTZW5kZXJJZCI6IjM2NzMxNjQxNDE2NCIsImFwcElkIjoiMTozNjczMTY0MTQxNjQ6d2ViOmZjZTA3OWUxYzdmNDIyMzI5MjQ5MGIifQ==";

const ENCRYPTED_APP_CHECK_KEY = "NkxjNW1QQXNBQUFBQWpIU0V5dERpbmpFc1VObjhxMUEzRGVhWmM2eA==";

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYROR2fU0s4bVri_CTOMOTNeNi4tE0YxeekgtJncr-fPvGCGo3igXJfZlJR4Vq1Gwz4g/exec";

const decryptConfig = (encryptedData) => {
    try {
        const decoded = atob(encryptedData);
        return decoded;
    } catch (e) {
        return null;
    }
};

const getFirebaseConfig = () => {
    const decrypted = decryptConfig(ENCRYPTED_CONFIG);
    if (!decrypted) {
        throw new Error("Nepodarilo sa dešifrovať Firebase konfiguráciu");
    }
    
    try {
        const config = JSON.parse(decrypted);
        return config;
    } catch (e) {
    }
};

const getAppCheckKey = () => {
    const decrypted = decryptConfig(ENCRYPTED_APP_CHECK_KEY);
    if (!decrypted) {
        return null;
    }
    return decrypted;
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const getAppBasePath = () => {
    const appYearMatch = appId.match(/(\d{4})/);
    const appYear = appYearMatch ? appYearMatch[1] : '2025';
    return `/${appYear}`;
};

const appBasePath = getAppBasePath();

const publicPages = [
    'account.html',
    'admin-register.html',
    'index.html',
    'login.html',
    'register.html',
    'volunteer-register.html',
    'teams-in-groups.html',
    'matches.html', 
    'map.html', 
    'tables.html'
];

const guestOnlyPages = [
    'login.html',
    'register.html',
    'admin-register.html',
    'volunteer-register.html'
];

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

let app;
let db;
let auth;
let appCheck;

let pageVisibilityCache = null;
let pageVisibilityCacheTime = null;
const PAGE_VISIBILITY_CACHE_TTL = 60000; 

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
        const firebaseConfig = getFirebaseConfig();
        
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);        

        const appCheckKey = getAppCheckKey();
        if (appCheckKey && isAppCheckSupported()) {
            try {
                appCheck = initializeAppCheck(app, {
                    provider: new ReCaptchaEnterpriseProvider(appCheckKey),
                    isTokenAutoRefreshEnabled: true
                });
            } catch (e) {
            }
        } else {
        }

        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        window.appCheck = appCheck;
        
        window.applyActionCode = applyActionCode;
        window.checkActionCode = checkActionCode;
        window.verifyPasswordResetCode = verifyPasswordResetCode;
        window.confirmPasswordReset = confirmPasswordReset;

        window.dispatchEvent(new CustomEvent('dbInitialized'));
        
    } catch (e) {
    }
};

const loadPageVisibilitySettings = async () => {
    if (!db) return null;
    
    const now = Date.now();
    if (pageVisibilityCache && pageVisibilityCacheTime && (now - pageVisibilityCacheTime) < PAGE_VISIBILITY_CACHE_TTL) {
        return pageVisibilityCache;
    }
    
    try {
        const pagesRef = collection(db, 'pages');
        const pagesSnapshot = await getDocs(pagesRef);
        
        const visibilitySettings = {};
        let matchesVisible = true; // predvolene viditeľné
        
        pagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
                if (doc.id === 'matches') {
                    matchesVisible = false;
                }
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
                if (doc.id === 'matches') {
                    matchesVisible = true;
                }
            }
        });
        
        // Nastavíme tables na rovnakú viditeľnosť ako matches
        visibilitySettings['tables'] = matchesVisible;
        
        pageVisibilityCache = visibilitySettings;
        pageVisibilityCacheTime = now;
        
        return visibilitySettings;
    } catch (error) {
        return null;
    }
};

const setupPageVisibilityListener = () => {
    if (!db) {
        return;
    }
    
    if (pageVisibilityUnsubscribe) {
        pageVisibilityUnsubscribe();
        pageVisibilityUnsubscribe = null;
        currentPageVisibilityListenerActive = false;
    }    
    
    const pagesRef = collection(db, 'pages');
    
    pageVisibilityUnsubscribe = onSnapshot(pagesRef, (snapshot) => {
        
        const visibilitySettings = {};
        let matchesVisible = true;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
                if (doc.id === 'matches') {
                    matchesVisible = false;
                }
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
                if (doc.id === 'matches') {
                    matchesVisible = true;
                }
            }
        });
        
        // Nastavíme tables na rovnakú viditeľnosť ako matches
        visibilitySettings['tables'] = matchesVisible;
        
        pageVisibilityCache = visibilitySettings;
        pageVisibilityCacheTime = Date.now();
               
        checkCurrentPageVisibility();
        
    }, (error) => {
    });
    
    currentPageVisibilityListenerActive = true;
};

const checkCurrentPageVisibility = async () => {
    if (!isHtmlPage()) {
        return;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    
    if (fileName === 'index.html') {
        return;
    }
    
    // Povolené stránky pre prihlásených používateľov (bez kontroly viditeľnosti)
    const allowedForLoggedIn = ['map.html', 'matches.html', 'teams-in-groups.html', 'tables.html'];
    if (allowedForLoggedIn.includes(fileName)) {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            // Skontrolujeme či je používateľ admin
            const userProfileData = window.globalUserProfileData;
            if (userProfileData && userProfileData.role === 'admin') {
                // Admin má prístup vždy
                return;
            }
            // Pre ostatných prihlásených používateľov necháme pokračovať na kontrolu viditeľnosti
        }
    }
    
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        return;
    }
    
    const pageId = fileName.replace('.html', '');
    
    // Pre tables použijeme viditeľnosť z matches
    let isVisible;
    if (pageId === 'tables') {
        isVisible = settings['matches'] !== undefined ? settings['matches'] : true;
    } else {
        if (settings[pageId] === undefined) {
            return;
        }
        isVisible = settings[pageId];
    }
    
    if (!isVisible) {
        // Skontrolujeme či je používateľ admin (ešte raz pre istotu)
        const userProfileData = window.globalUserProfileData;
        if (userProfileData && userProfileData.role === 'admin') {
            // Admin má prístup aj keď stránka nie je viditeľná
            return;
        }
        
        const loginUrl = `${appBasePath}/login.html`;
        window.location.href = loginUrl;
        return;
    }
};

const isPageVisibleInSettings = async (pageId) => {
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        return true;
    }
    
    // Ak sa pýtame na tables, vrátime hodnotu pre matches
    if (pageId === 'tables') {
        return settings['matches'] !== undefined ? settings['matches'] : true;
    }
    
    if (settings[pageId] === undefined) {
        return true;
    }
    
    const isVisible = settings[pageId];
    return isVisible;
};

const isHtmlPage = () => {
    const currentPath = window.location.pathname;
    return currentPath.includes('.html');
};

const getFileNameFromPath = (path) => {
    if (!path.includes('.html')) {
        return '';
    }
    const parts = path.split('/');
    return parts[parts.length - 1];
};

const isPublicPage = () => {
    if (!isHtmlPage()) {
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = publicPages.includes(fileName);
    return result;
};

const isPageAccessibleForGuest = async () => {
    if (!isHtmlPage()) {
        return true;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    
    if (fileName === 'map.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    if (fileName === 'matches.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    if (fileName === 'teams-in-groups.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    // Pre tables použijeme rovnakú logiku ako pre matches
    if (fileName === 'tables.html') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        // Pre neprihlásených používateľov skontrolujeme viditeľnosť podľa matches
        const isVisible = await isPageVisibleInSettings('tables');
        return isVisible;
    }
    
    if (!publicPages.includes(fileName)) {
        return false;
    }
    
    if (fileName === 'index.html') {
        return true;
    }
    
    const pageId = fileName.replace('.html', '');
    const isVisible = await isPageVisibleInSettings(pageId);
    
    if (!isVisible) {
        return false;
    }
    
    return true;
};

const isGuestOnlyPage = () => {
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = guestOnlyPages.includes(fileName);
    return result;
};

const isOnLoginPage = () => {
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const result = fileName === 'login.html';
    return result;
};

const isOnRegistrationPage = () => {
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const registrationPages = ['register.html', 'admin-register.html', 'volunteer-register.html'];
    const result = registrationPages.includes(fileName);
    return result;
};

const isPrivatePage = () => {
    return !isPublicPage();
};

const hasAccessToPage = (userRole, currentPage) => {
    if (!userRole || !currentPage) return false;
    
    if (!roleAccess[userRole]) {
        return false;
    }
    
    const allowedPages = roleAccess[userRole];
    const hasAccess = allowedPages.includes(currentPage);
    
    return hasAccess;
};

let registrationLogoutTimeout = null;

const checkRegistrationTimer = (userProfileData) => {
    if (registrationLogoutTimeout) {
        clearTimeout(registrationLogoutTimeout);
        registrationLogoutTimeout = null;
    }
    
    if (!isOnRegistrationPage()) {
        return;
    }
    
    if (!userProfileData || !userProfileData.registrationDate) {
        return;
    }
    
    let registrationTimestamp;
    if (userProfileData.registrationDate.seconds) {
        registrationTimestamp = userProfileData.registrationDate.seconds * 1000;
    } else if (typeof userProfileData.registrationDate === 'number') {
        registrationTimestamp = userProfileData.registrationDate;
    } else {
        return;
    }
    
    const currentTime = Date.now();
    const expiryTime = registrationTimestamp + 20000;
    const timeUntilExpiry = expiryTime - currentTime;    
    
    if (timeUntilExpiry > 0) {
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

const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {            
            const userDocRef = doc(db, `users/${user.uid}`);
            
            const loadUserProfileData = async (retries = 0) => {
                const MAX_RETRIES = 3; 
                const RETRY_DELAY = 200;
            
                try {
                    const docSnap = await getDoc(userDocRef);
            
                    if (!docSnap.exists()) {
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
            
                    if (window.unsubscribeUserDoc) {
                        window.unsubscribeUserDoc();
                    }
            
                    window.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const userProfileData = { id: snapshot.id, ...snapshot.data() };
                            
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                
                                checkRegistrationTimer(userProfileData);
                                return;
                            }
            
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
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
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                if (currentPage === 'map.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                    
                                if (currentPage === 'matches.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                if (currentPage === 'teams-in-groups.html') {
                                    window.globalUserProfileData = userProfileData;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                    return;
                                }
                                
                                if (isCurrentPageGuestOnly) {
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
                                if (isOnLoginPage()) {
                                    window.location.href = targetPathMyData;
                                    return;
                                }
                                
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
            
            if (registrationLogoutTimeout) {
                clearTimeout(registrationLogoutTimeout);
                registrationLogoutTimeout = null;
            }
            
            if (!isHtmlPage()) {
                return;
            }
            
            const currentFileName = getFileNameFromPath(window.location.pathname);
            
            const isAccessible = await isPageAccessibleForGuest();
                        
            if (!isAccessible) {
                const indexUrl = `${appBasePath}/index.html`;
                window.location.href = indexUrl;
                return;
            }
            
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
    
    const checkAndSetupListener = () => {
        if (db && auth) {
            setupPageVisibilityListener();
        } else {
            setTimeout(checkAndSetupListener, 500);
        }
    };
    
    setTimeout(checkAndSetupListener, 1000);
});
