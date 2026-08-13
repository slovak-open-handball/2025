// authentication.js
// Tento súbor spravuje globálnu autentifikáciu, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.
// 🔥 VŠETKY FIREBASE OPERÁCIE IDÚ CEZ CLOUDFLARE WORKER

// Globálne premenné
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
const WORKER_URL = 'https://worker.miloslav-mihucky.workers.dev';

// 🔥 Firebase Client SDK (POUZE PRE PRIHLASOVANIE)
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

// Firebase konfigurácia (LEN PRE AUTENTIFIKÁCIU)
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

// 📡 VOLANIE WORKERA
const callWorker = async (endpoint, options = {}) => {
    const url = `${WORKER_URL}${endpoint}`;
    
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

// 📥 NAČÍTANIE PROFILU
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

// 📤 AKTUALIZÁCIA PROFILU
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

// 🗺️ NAČÍTANIE NASTAVENÍ STRÁNOK
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

// 📧 ODOSLANIE EMAILU
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

// 🛠️ UNIVERZÁLNA FUNKCIA PRE PRÁCU S DATABÁZOU CEZ WORKER
const firestore = {
    getDoc: async (path) => {
        try {
            return await callWorker(`/api/${path}`);
        } catch (error) {
            console.error(`❌ Chyba pri načítaní ${path}:`, error);
            throw error;
        }
    },
    
    updateDoc: async (path, data) => {
        try {
            return await callWorker(`/api/${path}/update`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error(`❌ Chyba pri aktualizácii ${path}:`, error);
            throw error;
        }
    },
    
    getCollection: async (collectionName) => {
        try {
            return await callWorker(`/api/${collectionName}`);
        } catch (error) {
            console.error(`❌ Chyba pri načítaní kolekcie ${collectionName}:`, error);
            throw error;
        }
    },
    
    onSnapshot: (path, callback) => {
        console.warn('⚠️ onSnapshot nie je podporovaný cez Worker, používam periodické načítanie');
        
        let intervalId = null;
        let isRunning = true;
        
        const fetchData = async () => {
            if (!isRunning) return;
            try {
                const data = await callWorker(`/api/${path}`);
                callback({
                    exists: !!data,
                    data: () => data,
                    id: path.split('/').pop(),
                });
            } catch (error) {
                console.error('❌ Chyba pri načítaní:', error);
            }
        };
        
        fetchData();
        intervalId = setInterval(fetchData, 5000);
        
        return () => {
            isRunning = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
    }
};

// 🔧 EXPORT FUNKCIÍ
window.callWorker = callWorker;
window.loadUserProfileData = loadUserProfileData;
window.updateUserProfile = updateUserProfile;
window.loadPageVisibilitySettings = loadPageVisibilitySettings;
window.sendEmail = sendEmail;
window.firestore = firestore;
window.WORKER_URL = WORKER_URL;

// ... (zvyšok kódu - handleAuthState, presmerovania, atď.)
