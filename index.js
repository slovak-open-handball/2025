// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií

// Import necessary Firebase functions
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase, podľa požiadavky
// POZNÁMKA: Táto konfigurácia bude prepísaná globálnou premennou '__firebase_config'.
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Inicializácia Firebase a nastavenie globálnych premenných
function setupFirebase() {
    try {
        // Používame globálne premenné poskytnuté prostredím Canvas
        const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
        
        // Dôležitá zmena: Skontrolujeme, či už neexistuje inicializovaná aplikácia.
        if (getApps().length === 0) {
            const app = initializeApp(config);
            window.auth = getAuth(app);
            window.db = getFirestore(app);
            window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            
            // Dôležitý fix: Sprístupníme funkciu 'doc' globálne
            window.doc = doc; 

            console.log("AuthManager: Firebase inicializované.");
        } else {
            console.log("AuthManager: Firebase už bolo inicializované.");
            window.auth = getAuth();
            window.db = getFirestore();
            window.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            window.doc = doc;
        }
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
}


// Spracovanie stavu autentifikácie
const handleAuthState = () => {
    // Perform initial authentication using the provided custom token
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
        // Ak nie je k dispozícii žiadny vlastný token, nebudeme sa pokúšať o anonymné prihlásenie
        // Tým sa vyhneme chybe, ak je anonymné prihlásenie zakázané v Firebase.
        console.log("AuthManager: Nie je k dispozícii žiadny vlastný token, preskakujem prihlásenie.");
    }


    let unsubscribeUserDoc = null;
    onAuthStateChanged(window.auth, (user) => {
        if (!window.isGlobalAuthReady) {
            window.isGlobalAuthReady = true;
            console.log("AuthManager: Počiatočný stav autentifikácie skontrolovaný.");
        }

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            
            // Načítanie profilu používateľa z Firestore
            // Používame onSnapshot pre sledovanie zmien v reálnom čase
            // POZNÁMKA: Cesta k Firestore bola upravená tak, aby používala __app_id
            const userDocRef = doc(window.db, `artifacts/${window.appId}/users/${user.uid}/profile/data`);
            
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.globalUserProfileData = docSnap.data();
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

            // Pridáme listener na odhlásenie, ak je užívateľ na stránke
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
window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
