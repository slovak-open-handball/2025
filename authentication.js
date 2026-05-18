// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.
// TERAZ S APP CHECK PRE OCHRANU PROTI ČÍTANIU Z INÝCH STRÁNOK

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.appCheck = null; // Inštancia Firebase App Check
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií
window.reauthenticateWithCredential = null; // Funkcia pre re-autentifikáciu
window.as = null; // Funkcia na zmenu emailu
window.EmailAuthProvider = null; // Poskytovateľ autentifikácie pre email
window.verifyBeforeUpdateEmail = null; // Funkcia na overenie emailu pred zmenu
window.isRegisteringAdmin = false; // NOVÁ GLOBÁLNA PREMENNÁ: Signalizuje, že prebieha registrácia admina

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
import {
    initializeAppCheck,
    ReCaptchaV3Provider,
    getToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app-check.js";

// Vložený konfiguračný objekt, ktorý ste poskytli
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

// Definovanie globálnych premenných, ktoré sú poskytnuté z Canvas prostredia
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Extrahovanie roku z appId alebo predvolené nastavenie
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
    'logged-in-all-registrations.html',
    'logged-in-map.html',
    'logged-in-matches-hall.html',
    'logged-in-matches.html',
    'logged-in-my-data.html',
    'logged-in-my-settings.html',
    'logged-in-notifications.html',
    'logged-in-rosters.html',
    'logged-in-teams-in-accommodation.html',
    'logged-in-teams-in-groups.html',
    'logged-in-template.html',
    'logged-in-tournament-settings.html',
    'logged-in-users.html',
];

// Inicializácia Firebase aplikácie
let app;
let db;
let auth;

// ===== NOVÁ FUNKCIA PRE APP CHECK =====
// ReCaptcha site key - musíte si vytvoriť vlastný v Google Cloud Console
// https://console.cloud.google.com/security/recaptcha
// Pre vývoj môžete použiť demo kľúč, ale pre produkciu si vytvorte vlastný
const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // DEMO KEY - NAHRAĎTE VAŠÍM!

// Funkcia na overenie, či App Check beží v debug móde
const isDebugMode = () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.search.includes('debug=true');
};

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // INICIALIZÁCIA APP CHECK PRE OCHRANU PROTI ČÍTANIU Z INÝCH STRÁNOK
        if (typeof window !== 'undefined') {
            // Nastavenie debug tokenu pre vývoj
            if (isDebugMode()) {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                console.log("App Check: Debug mód zapnutý - používam debug token");
            } else {
                self.FIREBASE_APPCHECK_DEBUG_TOKEN = false;
            }
            
            // Inicializácia App Check s ReCaptcha v3
            try {
                const appCheck = initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
                    isTokenAutoRefreshEnabled: true
                });
                window.appCheck = appCheck;
                console.log("App Check: Úspešne inicializovaný s ReCaptcha");
                
                // Testovacie získanie tokenu (pre debug)
                if (isDebugMode()) {
                    getToken(appCheck, { forceRefresh: true }).then(token => {
                        console.log("App Check: Debug token získaný:", token);
                    }).catch(err => {
                        console.error("App Check: Chyba pri získavaní debug tokenu:", err);
                    });
                }
            } catch (appCheckError) {
                console.error("App Check: Chyba pri inicializácii:", appCheckError);
                // App Check nie je kritický pre fungovanie aplikácie, pokračujeme
            }
        }
        
        console.log("AuthManager: Firebase inicializovaný s App Check podporou.");

        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.firebaseConfig = firebaseConfig;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
        
        // ===== NOVÁ FUNKCIA PRE KONTROLU APP CHECK TOKENU =====
        window.verifyAppCheckToken = async () => {
            if (!window.appCheck) {
                console.warn("App Check nie je inicializovaný");
                return false;
            }
            
            try {
                const token = await getToken(window.appCheck, { forceRefresh: false });
                console.log("App Check token je platný:", token.token);
                return true;
            } catch (error) {
                console.error("App Check token je neplatný:", error);
                return false;
            }
        };
        
        // ===== KONTROLA PÔVODU STRÁNKY (DOMÉNY) =====
        window.validatePageOrigin = () => {
            const allowedOrigins = [
                window.location.origin, // Aktuálna doména
                // Pridajte vaše ďalšie povolené domény:
                // 'https://vasastranka.sk',
                // 'https://www.vasastranka.sk'
            ];
            
            // Kontrola, či sme na správnej doméne
            const currentOrigin = window.location.origin;
            if (!allowedOrigins.includes(currentOrigin)) {
                console.error("Neoprávnený prístup: Stránka beží na nesprávnej doméne:", currentOrigin);
                document.body.innerHTML = '<h1>Prístup zamietnutý</h1><p>Táto stránka je dostupná len z autorizovaných domén.</p>';
                throw new Error("Neoprávnená doména");
            }
            
            // Kontrola referrer (ak existuje)
            if (document.referrer && document.referrer !== '') {
                const isAllowedReferrer = allowedOrigins.some(origin => document.referrer.startsWith(origin));
                if (!isAllowedReferrer) {
                    console.warn("Podozrivý referrer - možný pokus o krádež dát:", document.referrer);
                    // Tu môžete pridať dodatočnú logiku - napr. odhlásenie používateľa
                    return false;
                }
            }
            return true;
        };
        
        // Spustenie validácie pôvodu
        if (!window.validatePageOrigin()) {
            console.error("Validácia pôvodu stránky zlyhala!");
        }
        
    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", e);
    }
};

const handleAuthState = async () => {
    onAuthStateChanged(auth, async (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený:", user.uid);
            
            // Správna cesta k profilovému dokumentu na základe poskytnutých pravidiel
            const userDocRef = doc(db, `users/${user.uid}`);
            
            // Funkcia na opakované pokusy o načítanie dokumentu
            const loadUserProfileData = async (retries = 0) => {
                const MAX_RETRIES = 5;
                const RETRY_DELAY = 500;

                try {
                    const docSnap = await getDoc(userDocRef);

                    if (!docSnap.exists()) {
                        if (retries < MAX_RETRIES) {
                            console.warn(`AuthManager: Dokument profilu používateľa vo Firestore zatiaľ neexistuje. Pokus ${retries + 1}/${MAX_RETRIES}. Opakujem za ${RETRY_DELAY / 1000}s.`);
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                            return loadUserProfileData(retries + 1);
                        } else {
                            console.error("AuthManager: Dokument profilu používateľa nebol nájdený ani po opakovaných pokusoch. Pravdepodobne nastal problém pri zápise.");
                            window.globalUserProfileData = null;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                            return;
                        }
                    }

                    // Ak dokument existuje, môžeme bezpečne pripojiť onSnapshot
                    if (window.unsubscribeUserDoc) {
                        window.unsubscribeUserDoc();
                    }

                    window.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const userProfileData = { id: snapshot.id, ...snapshot.data() };
                            
                            // Ak prebieha registrácia admina, potlačíme akékoľvek odhlasovanie alebo presmerovanie
                            if (window.isRegisteringAdmin && userProfileData.role === 'admin' && (userProfileData.approved === false || userProfileData.approved === true)) {
                                console.log("AuthManager: Prebieha registrácia administrátora. Automatické odhlásenie/presmerovanie z authentication.js je potlačené.");
                                window.globalUserProfileData = userProfileData;
                                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: userProfileData }));
                                return;
                            }

                            // Pôvodná logika pre neschváleného administrátora
                            if (userProfileData.role === 'admin' && userProfileData.approved === false) {
                                console.warn("AuthManager: Nepovolený administrátor detekovaný. Odhlasujem používateľa a posielam e-mail s pripomenutím.");

                                const adminEmail = userProfileData.email;
                                const adminFirstName = userProfileData.firstName || '';
                                const adminLastName = userProfileData.lastName || '';

                                const emailPayload = {
                                    action: 'sendAdminApprovalReminder',
                                    email: adminEmail,
                                    firstName: adminFirstName,
                                    lastName: adminLastName,
                                };

                                let innerRetryCount = 0;
                                const innerMaxRetries = 3;
                                const innerBaseDelay = 1000;

                                const sendReminderEmail = async () => {
                                    try {
                                        console.log("AuthManager: Pokúšam sa odoslať e-mail s pripomenutím schválenia admina...");
                                        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                            },
                                            mode: 'no-cors',
                                            body: JSON.stringify(emailPayload)
                                        });
                                        console.log("AuthManager: Apps Script odpoveď pre pripomenutie schválenia (no-cors):", response);
                                    } catch (emailError) {
                                        console.error("AuthManager: Chyba pri odosielaní e-mailu s pripomenutím schválenia:", emailError);
                                        if (innerRetryCount < innerMaxRetries) {
                                            innerRetryCount++;
                                            const delay = innerBaseDelay * Math.pow(2, innerRetryCount - 1);
                                            console.log(`AuthManager: Opakujem pokus o odoslanie e-mailu za ${delay / 1000} sekúnd (pokus ${innerRetryCount}/${innerMaxRetries}).`);
                                            setTimeout(sendReminderEmail, delay);
                                        } else {
                                            console.error("AuthManager: Maximálny počet pokusov na odoslanie e-mailu s pripomenutím schválenia dosiahnutý.");
                                        }
                                    }
                                };
                                sendReminderEmail();

                                signOut(auth).then(() => {
                                    window.globalUserProfileData = null;
                                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                                    window.location.href = `${appBasePath}/login.html?status=unapproved_admin`; 
                                }).catch((error) => {
                                    console.error("AuthManager: Chyba pri odhlasovaní neschváleného administrátora:", error);
                                });
                                return;
                            } 
                            // Logika pre schválených používateľov
                            else if (userProfileData.approved === true) {
                                const currentPath = window.location.pathname;
                                const targetPathMyData = `${appBasePath}/logged-in-my-data.html`;
                                const loginPath = `${appBasePath}/login.html`;

                                if (currentPath.includes(loginPath)) {
                                    console.log(`AuthManager: Schválený používateľ typu '${userProfileData.role}' sa prihlásil z prihlasovacej stránky. Presmerovávam na logged-in-my-data.html.`);
                                    window.location.href = targetPathMyData;
                                } 
                                else if (userProfileData.role !== 'admin' && blockedPages.some(page => currentPath.includes(page))) {
                                    console.log(`AuthManager: Používateľ typu '${userProfileData.role}' sa pokúsil o prístup na zablokovanú stránku. Presmerovávam na logged-in-my-data.html.`);
                                    window.location.href = targetPathMyData;
                                } else {
                                    console.log(`AuthManager: Schválený používateľ typu '${userProfileData.role}' je už prihlásený a má prístup k aktuálnej stránke. Zostávam na aktuálnej stránke.`);
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
                    console.error("AuthManager: Chyba pri jednorazovom načítaní profilu:", error);
                    window.globalUserProfileData = null;
                    window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                }
            };

            loadUserProfileData();

        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
        }

        window.addEventListener('beforeunload', () => {
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

// ===== NOVÁ FUNKCIA PRE MONITOROVANIE APP CHECK STAVU =====
const monitorAppCheckStatus = () => {
    setInterval(async () => {
        if (window.appCheck) {
            try {
                const token = await getToken(window.appCheck, { forceRefresh: false });
                console.log("App Check heart-beat: Token je platný, expirácia:", token.expireTime);
            } catch (error) {
                console.error("App Check heart-beat: Token je neplatný!", error);
                // Tu môžete pridať logiku pre prípad, že App Check zlyhá
                // Napr. zobraziť upozornenie používateľovi
                if (window.showGlobalNotification) {
                    window.showGlobalNotification('Bezpečnostný token vypršal, obnovujem...', 'warning');
                }
            }
        }
    }, 10 * 60 * 1000); // Kontrola každých 10 minút
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
    monitorAppCheckStatus();
    
    // ===== PRIDANIE GLOBÁLNEJ FUNKCIE PRE TESTOVANIE APP CHECK =====
    window.testAppCheck = async () => {
        if (!window.appCheck) {
            console.error("App Check nie je inicializovaný");
            return { success: false, error: "App Check not initialized" };
        }
        
        try {
            const token = await getToken(window.appCheck, { forceRefresh: true });
            console.log("App Check test successful:", token);
            return { success: true, token: token.token, expireTime: token.expireTime };
        } catch (error) {
            console.error("App Check test failed:", error);
            return { success: false, error: error.message };
        }
    };
    
    console.log("Authentication.js úplne načítaný s App Check podporou");
    console.log("Pre otestovanie App Check zavolajte window.testAppCheck()");
});
