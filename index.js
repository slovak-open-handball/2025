// index.js
// Tento súbor bol upravený, aby sa predišlo duplicitnej inicializácii a spracovaniu autentifikácie.
// Používa globálne premenné a funkcie definované v authentication.js.

// Pevne definovaná konfigurácia Firebase, podľa požiadavky
// POZNÁMKA: Táto konfigurácia sa nebude používať, ak je definovaná globálna premenná '__firebase_config'.
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Import necessary Firebase functions
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Inicializácia Firebase a nastavenie globálnych premenných
// Táto funkcia zabezpečí, že sa Firebase inicializuje len raz.
const setupFirebase = () => {
    try {
        const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
        
        // Dôležitá zmena: Skontrolujeme, či už neexistuje inicializovaná aplikácia.
        if (getApps().length === 0) {
            const app = initializeApp(config);
            window.auth = getAuth(app);
            window.db = getFirestore(app);
            window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            
            console.log("AuthManager: Firebase inicializované.");
        } else {
            console.log("AuthManager: Firebase už bolo inicializované.");
            window.auth = getAuth();
            window.db = getFirestore();
            window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        }
        
        // Sprístupníme funkciu 'doc' globálne
        window.doc = doc;
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Spracovanie stavu autentifikácie
const handleAuthState = () => {
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    
    if (initialAuthToken) {
        signInWithCustomToken(window.auth, initialAuthToken)
            .then(() => {
                console.log("AuthManager: Úspešne prihlásený s vlastným tokenom.");
            })
            .catch((error) => {
                console.error("AuthManager: Chyba pri prihlasovaní s vlastným tokenom:", error);
            });
    } else {
        console.log("AuthManager: Nie je k dispozícii žiadny vlastný token, preskakujem prihlásenie.");
    }

    let unsubscribeUserDoc = null;
    onAuthStateChanged(window.auth, (user) => {
        if (!window.isGlobalAuthReady) {
            window.isGlobalAuthReady = true;
            console.log("AuthManager: Počiatočný stav autentifikácie skontrolovaný.");
            // Po skontrolovaní počiatočného stavu odošleme udalosť, že autentifikácia je pripravená
            window.dispatchEvent(new CustomEvent('authReady'));
        }

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            
            const userDocRef = doc(window.db, `artifacts/${window.appId}/users/${user.uid}/profile/data`);
            
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = { id: docSnap.id, ...docSnap.data() };
                    console.log("AuthManager: Profil používateľa načítaný a aktuálny.", window.globalUserProfileData);
                } else {
                    console.log("AuthManager: Profil používateľa nebol nájdený.");
                    window.globalUserProfileData = null;
                }

                // Odošleme udalosť, že dáta boli aktualizované
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
            });

            window.addEventListener('beforeunload', () => {
                if (unsubscribeUserDoc) {
                    unsubscribeUserDoc();
                }
            });
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            // Odošleme udalosť aj pri odhlásení
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};


// Spustenie inicializácie po načítaní DOM
window.addEventListener('DOMContentLoaded', () => {
    setupFirebase();
    handleAuthState();
});
