// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false; // Indikuje, či je Firebase Auth inicializované a prvý stav používateľa skontrolovaný
window.globalUserProfileData = null; // Obsahuje dáta profilu prihláseného používateľa
window.auth = null; // Inštancia Firebase Auth
window.db = null; // Inštancia Firebase Firestore
window.showGlobalNotification = null; // Funkcia pre zobrazenie globálnych notifikácií
window.reauthenticateWithCredential = null; // Funkcia pre re-autentifikáciu
window.updateEmail = null; // Funkcia na zmenu emailu
window.EmailAuthProvider = null; // Poskytovateľ autentifikácie pre email

// Import necessary Firebase functions
import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword,
    reauthenticateWithCredential, // Dôležité: pridaný import
    updateEmail, // Dôležité: pridaný import
    EmailAuthProvider // Dôležité: pridaný import
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Pevne definovaná konfigurácia Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.appspot.com",
    messagingSenderId: "367316414164",
    appId: "1:367316414164:web:fce079e1c7f4223292490b"
};

const setupFirebase = () => {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);
        
        // Sprístupníme potrebné funkcie globálne
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;

        console.log("AuthManager: Firebase inicializovaný.");
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii Firebase:", error);
        // Zobrazí globálnu notifikáciu, ak je dostupná
        if (window.showGlobalNotification) {
            window.showGlobalNotification("Chyba pri inicializácii aplikácie. Skúste to prosím neskôr.", 'error');
        }
    }
};

const handleAuthState = () => {
    // Nastavenie listenera, ktorý sa spustí pri každej zmene stavu prihlásenia
    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;
        console.log("AuthManager: Zmena stavu autentifikácie, používateľ:", user);

        // Zrušíme predchádzajúci listener, ak existuje
        if (window.unsubscribeUserDoc) {
            window.unsubscribeUserDoc();
            window.unsubscribeUserDoc = null;
        }

        if (user) {
            // Používateľ je prihlásený, načítame a sledujeme jeho profilové dáta
            const userDocRef = doc(window.db, 'users', user.uid);
            
            window.unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
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
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }
        });
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
};

window.addEventListener('DOMContentLoaded', async () => {
    setupFirebase();
    handleAuthState();
});
