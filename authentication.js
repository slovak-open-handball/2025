// authentication.js

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
    where,
    updateDoc,
    serverTimestamp
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
    'account',
    'admin-register',
    'index',
    'login',
    'register',
    'volunteer-register',
    'teams-in-groups',
    'matches', 
    'map', 
    'tables',
    'teams',
    'statistics',
    'catering',
    'transport'
];

const guestOnlyPages = [
    'login',
    'register',
    'admin-register',
    'volunteer-register'
];

const roleAccess = {
    admin: [
        'logged-in-add-categories',
        'logged-in-add-groups',
        'logged-in-all-registrations',
        'logged-in-map',
        'logged-in-matches',
        'logged-in-catering',
        'logged-in-my-data',
        'logged-in-notifications',
        'logged-in-rosters',
        'logged-in-teams-in-accommodation',
        'logged-in-teams-in-groups',
        'logged-in-template',
        'logged-in-tournament-settings',
        'logged-in-users',
        'logged-in-export',
        'logged-in-transport'
    ],
    hall: [
        'logged-in-my-data',
        'logged-in-matches-hall'
    ],
    club: [
        'logged-in-my-data',
        'logged-in-rosters',
        'logged-in-teams',
    ],
    volunteer: [
        'logged-in-my-data'
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

const recordLogout = async (user) => {
    if (!user || !db) return;
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            lastLogoutAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Nepodarilo sa zapísať lastLogoutAt:', e);
    }
};

const recordLogin = async (user) => {
    if (!user || !db) return;
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            lastLoginAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Nepodarilo sa zapísať lastLoginAt:', e);
    }
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
        let teamsInGroupsVisible = true; // predvolene viditeľné
        let rostersVisible = true; // predvolene viditeľné
        let cateringVisible = true; // predvolene skryté
        let transportVisible = true; // predvolene skryté (rovnako ako catering)
        
        pagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
                if (doc.id === 'matches') {
                    matchesVisible = false;
                }
                if (doc.id === 'teams-in-groups') {
                    teamsInGroupsVisible = false;
                }
                if (doc.id === 'rosters') {
                    rostersVisible = false;
                }
                if (doc.id === 'catering') {
                    cateringVisible = false;
                }
                if (doc.id === 'transport') {
                    transportVisible = false;
                }
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
                if (doc.id === 'matches') {
                    matchesVisible = true;
                }
                if (doc.id === 'teams-in-groups') {
                    teamsInGroupsVisible = true;
                }
                if (doc.id === 'rosters') {
                    rostersVisible = true;
                }
                if (doc.id === 'catering') {
                    cateringVisible = true;
                }
                if (doc.id === 'transport') {
                    transportVisible = true;
                }
            }
        });
        
        // Nastavíme tables na rovnakú viditeľnosť ako matches
        visibilitySettings['tables'] = matchesVisible;
        
        // Nastavíme teams na rovnakú viditeľnosť ako teams-in-groups
        visibilitySettings['teams'] = teamsInGroupsVisible;
        
        // Nastavíme statistics na rovnakú viditeľnosť ako rosters
        visibilitySettings['statistics'] = rostersVisible;
        
        // catering a transport sú riadené vlastným nastavením
        visibilitySettings['catering'] = cateringVisible;
        visibilitySettings['transport'] = transportVisible;
        
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
        let teamsInGroupsVisible = true;
        let rostersVisible = true;
        let cateringVisible = true;
        let transportVisible = true;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.visible === false) {
                visibilitySettings[doc.id] = false;
                if (doc.id === 'matches') {
                    matchesVisible = false;
                }
                if (doc.id === 'teams-in-groups') {
                    teamsInGroupsVisible = false;
                }
                if (doc.id === 'rosters') {
                    rostersVisible = false;
                }
                if (doc.id === 'catering') {
                    cateringVisible = false;
                }
                if (doc.id === 'transport') {
                    transportVisible = false;
                }
            } else if (data.visible === true) {
                visibilitySettings[doc.id] = true;
                if (doc.id === 'matches') {
                    matchesVisible = true;
                }
                if (doc.id === 'teams-in-groups') {
                    teamsInGroupsVisible = true;
                }
                if (doc.id === 'rosters') {
                    rostersVisible = true;
                }
                if (doc.id === 'catering') {
                    cateringVisible = true;
                }
                if (doc.id === 'transport') {
                    transportVisible = true;
                }
            }
        });
        
        // Nastavíme tables na rovnakú viditeľnosť ako matches
        visibilitySettings['tables'] = matchesVisible;
        
        // Nastavíme teams na rovnakú viditeľnosť ako teams-in-groups
        visibilitySettings['teams'] = teamsInGroupsVisible;
        
        // Nastavíme statistics na rovnakú viditeľnosť ako rosters
        visibilitySettings['statistics'] = rostersVisible;
        
        // catering a transport sú riadené vlastným nastavením
        visibilitySettings['catering'] = cateringVisible;
        visibilitySettings['transport'] = transportVisible;
        
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
    
    if (fileName === 'index') {
        return;
    }
    
    // Povolené stránky pre prihlásených používateľov (bez kontroly viditeľnosti)
    // catering a transport sú tu pridané, aby sa aj pre prihlásených kontrolovala viditeľnosť
    const allowedForLoggedIn = ['map', 'matches', 'teams-in-groups', 'tables', 'teams', 'statistics', 'catering', 'transport'];
    if (allowedForLoggedIn.includes(fileName)) {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            const userProfileData = window.globalUserProfileData;
            if (userProfileData && userProfileData.role === 'admin') {
                // Admin má prístup vždy - ale rešpektujeme nastavenia viditeľnosti
            }
        }
    }
    
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        return;
    }
    
    const pageId = fileName.replace('', '');
    
    // Pre tables použijeme viditeľnosť z matches
    let isVisible;
    if (pageId === 'tables') {
        isVisible = settings['matches'] !== undefined ? settings['matches'] : true;
    } 
    // Pre teams použijeme viditeľnosť z teams-in-groups
    else if (pageId === 'teams') {
        isVisible = settings['teams-in-groups'] !== undefined ? settings['teams-in-groups'] : true;
    }
    // Pre statistics použijeme viditeľnosť z rosters
    else if (pageId === 'statistics') {
        isVisible = settings['rosters'] !== undefined ? settings['rosters'] : true;
    }
    // catering a transport majú vlastnú viditeľnosť
    else if (pageId === 'catering' || pageId === 'transport') {
        isVisible = settings[pageId] !== undefined ? settings[pageId] : true;
    }
    else {
        if (settings[pageId] === undefined) {
            return;
        }
        isVisible = settings[pageId];
    }
    
    if (!isVisible) {        
        const loginUrl = `${appBasePath}/login`;
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
    
    // Ak sa pýtame na teams, vrátime hodnotu pre teams-in-groups
    if (pageId === 'teams') {
        return settings['teams-in-groups'] !== undefined ? settings['teams-in-groups'] : true;
    }
    
    // Ak sa pýtame na statistics, vrátime hodnotu pre rosters
    if (pageId === 'statistics') {
        return settings['rosters'] !== undefined ? settings['rosters'] : true;
    }
    
    // catering a transport majú vlastnú viditeľnosť (predvolene false)
    if (pageId === 'catering' || pageId === 'transport') {
        return settings[pageId] !== undefined ? settings[pageId] : true;
    }
    
    if (settings[pageId] === undefined) {
        return true;
    }
    
    const isVisible = settings[pageId];
    return isVisible;
};

const checkPageVisibilityForUser = async (pageName, userProfileData) => {
    const settings = await loadPageVisibilitySettings();
    if (!settings) {
        return true;
    }
    
    const pageId = pageName.replace('', '');
    
    // Pre tables použijeme viditeľnosť z matches
    let isVisible;
    if (pageId === 'tables') {
        isVisible = settings['matches'] !== undefined ? settings['matches'] : true;
    }
    // Pre teams použijeme viditeľnosť z teams-in-groups
    else if (pageId === 'teams') {
        isVisible = settings['teams-in-groups'] !== undefined ? settings['teams-in-groups'] : true;
    }
    // Pre statistics použijeme viditeľnosť z rosters
    else if (pageId === 'statistics') {
        isVisible = settings['rosters'] !== undefined ? settings['rosters'] : true;
    }
    // catering a transport majú vlastnú viditeľnosť
    else if (pageId === 'catering' || pageId === 'transport') {
        isVisible = settings[pageId] !== undefined ? settings[pageId] : true;
    }
    else {
        if (settings[pageId] === undefined) {
            return true;
        }
        isVisible = settings[pageId];
    }
    
    return isVisible;
};

const isHtmlPage = () => {
    const currentPath = window.location.pathname;
    return currentPath.includes('');
};

const getFileNameFromPath = (path) => {
    if (!path.includes('')) {
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
    
    if (fileName === 'map') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    if (fileName === 'matches') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    if (fileName === 'teams-in-groups') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
    }
    
    // Pre tables použijeme rovnakú logiku ako pre matches
    if (fileName === 'tables') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        const isVisible = await isPageVisibleInSettings('tables');
        return isVisible;
    }
    
    // Pre catering - viditeľnosť sa riadi priamo dokumentom 'catering' v DB
    if (fileName === 'catering') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        const isVisible = await isPageVisibleInSettings('catering');
        return isVisible;
    }
    
    // Pre transport - viditeľnosť sa riadi priamo dokumentom 'transport' v DB
    if (fileName === 'transport') {
        const isLoggedIn = isReallyLoggedIn();
        if (isLoggedIn) {
            return true;
        }
        const isVisible = await isPageVisibleInSettings('transport');
        return isVisible;
    }
    
    if (!publicPages.includes(fileName)) {
        return false;
    }
    
    if (fileName === 'index') {
        return true;
    }
    
    const pageId = fileName.replace('', '');
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
    const result = fileName === 'login';
    return result;
};

const isOnRegistrationPage = () => {
    if (!isHtmlPage()) {
        return false;
    }
    
    const currentPath = window.location.pathname;
    const fileName = getFileNameFromPath(currentPath);
    const registrationPages = ['register', 'admin-register', 'volunteer-register'];
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
                const currentUser = auth.currentUser;
                await recordLogout(currentUser);
                
                await signOut(auth);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                window.location.href = `${appBasePath}/login?status=registration_expired`;
            } catch (error) {
                window.location.href = `${appBasePath}/login`;
            }
        }, timeUntilExpiry);
    } else {        
        if (isOnRegistrationPage()) {
            const targetPath = `${appBasePath}/logged-in-my-data`;
            window.location.href = targetPath;
        }
    }
};

const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            await recordLogin(user);
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
                                await recordLogout(auth.currentUser);
                                await signOut(auth);
                                window.globalUserProfileData = null;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                window.location.href = `${appBasePath}/login?status=profile_not_found`;
                            } catch (signOutError) {
                                window.location.href = `${appBasePath}/login?status=error`;
                            }

                            return;
                        }
                    }
            
                    if (window.unsubscribeUserDoc) {
                        window.unsubscribeUserDoc();
                    }
            
                    window.unsubscribeUserDoc = onSnapshot(userDocRef, async (snapshot) => {
                        if (snapshot.exists()) {
                            const userProfileData = { id: snapshot.id, ...snapshot.data() };
                            
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                
                                checkRegistrationTimer(userProfileData);
                                return;
                            }
                    
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
                                recordLogout(auth.currentUser).finally(() => {
                                    signOut(auth).then(() => {
                                        window.globalUserProfileData = null;
                                        window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                        window.location.href = `${appBasePath}/login?status=unapproved_admin`;
                                    });
                                });
                                return;
                            }
                            
                            else if (userProfileData.approved === true) {
                                const targetPathMyData = `${appBasePath}/logged-in-my-data`;
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
                                
                                if (isCurrentPagePublic && publicPages.includes(currentPage)) {
                                    const isVisible = await checkPageVisibilityForUser(currentPage, userProfileData);
                                    if (!isVisible) {
                                        window.location.href = `${appBasePath}/login`;
                                        return;
                                    }
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
                const indexUrl = `${appBasePath}/index`;
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
