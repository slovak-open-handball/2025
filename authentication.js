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
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "337775986422",
    appId: "1:337775986422:web:15f7f9175466c1b3c545e8"
};

// Funkcia na inicializáciu Firebase
const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        console.log("AuthManager: Firebase inicializované.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
    }
};

// Funkcia pre odhlásenie používateľa
const handleLogout = async () => {
    try {
        await signOut(window.auth);
        console.log("AuthManager: Používateľ bol úspešne odhlásený.");
        window.showGlobalNotification('Boli ste úspešne odhlásený.', 'success');
    } catch (error) {
        console.error("AuthManager: Chyba pri odhlasovaní:", error);
        window.showGlobalNotification('Chyba pri odhlasovaní. Skúste to prosím znova.', 'error');
    }
};
window.handleLogout = handleLogout; // Sprístupníme funkciu globálne

// Hlavná funkcia na spracovanie stavu autentifikácie
const handleAuthState = () => {
    let unsubscribeUserDoc = null;

    onAuthStateChanged(window.auth, async (user) => {
        if (!window.isGlobalAuthReady) {
            window.isGlobalAuthReady = true;
            console.log("AuthManager: Initial auth state checked.");
        }

        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
        }

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, UID:", user.uid);
            const userDocRef = doc(window.db, 'users', user.uid);
            
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userProfileData = { id: docSnap.id, ...docSnap.data() };
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
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
        }

        window.addEventListener('beforeunload', () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
