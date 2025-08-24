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
window.as = null; // Funkcia na zmenu emailu
window.EmailAuthProvider = null; // Poskytovateľ autentifikácie pre email
window.verifyBeforeUpdateEmail = null; // Funkcia na overenie emailu pred zmenu

// Import necessary Firebase functions
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut, // Import signOut function
    signInWithEmailAndPassword,
    reauthenticateWithCredential,
    updateEmail,
    EmailAuthProvider,
    verifyBeforeUpdateEmail
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc, // Potrebujeme getDoc pre jednorazové načítanie
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
    const appYearMatch = appId.match(/(\d{4})/); // Nájde prvú štvorcifernú skupinu
    const appYear = appYearMatch ? appYearMatch[1] : '2025'; // Použije nájdený rok alebo predvolené '2025'
    return `/${appYear}`;
};

const appBasePath = getAppBasePath(); // Získanie dynamickej základnej cesty


// Inicializácia Firebase aplikácie
let app;
let db;
let auth;

const setupFirebase = () => {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("AuthManager: Firebase inicializovaný.");

        // Pridáme globálne sprístupnené funkcie
        window.auth = auth;
        window.db = db;
        window.reauthenticateWithCredential = reauthenticateWithCredential;
        window.updateEmail = updateEmail;
        window.EmailAuthProvider = EmailAuthProvider;
        window.verifyBeforeUpdateEmail = verifyBeforeUpdateEmail;
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
            
            // Predtým, než sa pokúsime pripojiť onSnapshot,
            // najprv jednorazovo skúsime získať dokument.
            // Tým sa vyhneme race condition pri prvej registrácii.
            const docSnap = await getDoc(userDocRef);

            if (!docSnap.exists()) {
                console.warn("AuthManager: Dokument profilu používateľa vo Firestore zatiaľ neexistuje. Nastavujem globalUserProfileData na null a čakám na vytvorenie.");
                window.globalUserProfileData = null;
                window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                
                // Kľúčová zmena: Ak dokument neexistuje, nepripojíme onSnapshot ihneď,
                // ale necháme to na skript admin-register.js, aby dokončil svoju prácu.
                // Akonáhle admin-register.js vytvorí dokument, onAuthStateChanged sa znova spustí
                // (kvôli zmene v db) a tentokrát dokument už existovať bude.
                return; 
            }

            // Ak dokument existuje, môžeme bezpečne pripojiť onSnapshot
            if (window.unsubscribeUserDoc) {
                window.unsubscribeUserDoc();
            }

            window.unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
                if (snapshot.exists()) {
                    const userProfileData = { id: snapshot.id, ...snapshot.data() };
                    
                    // Logika pre neschváleného administrátora
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

                        let retryCount = 0;
                        const maxRetries = 3;
                        const baseDelay = 1000; // 1 second

                        const sendReminderEmail = async () => {
                            try {
                                console.log("AuthManager: Pokúšam sa odoslať e-mail s pripomenutím schválenia admina...");
                                const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    mode: 'no-cors', // Dôležité pre Apps Script, aby sa predišlo CORS chybám
                                    body: JSON.stringify(emailPayload)
                                });
                                console.log("AuthManager: Apps Script odpoveď pre pripomenutie schválenia (no-cors):", response);
                            } catch (emailError) {
                                console.error("AuthManager: Chyba pri odosielaní e-mailu s pripomenutím schválenia:", emailError);
                                if (retryCount < maxRetries) {
                                    retryCount++;
                                    const delay = baseDelay * Math.pow(2, retryCount - 1);
                                    console.log(`AuthManager: Opakujem pokus o odoslanie e-mailu za ${delay / 1000} sekúnd (pokus ${retryCount}/${maxRetries}).`);
                                    setTimeout(sendReminderEmail, delay);
                                } else {
                                    console.error("AuthManager: Maximálny počet pokusov na odoslanie e-mailu s pripomenutím schválenia dosiahnutý.");
                                }
                            }
                        };
                        sendReminderEmail(); // Iniciovanie odoslania e-mailu

                        signOut(auth).then(() => {
                            window.globalUserProfileData = null;
                            window.dispatchEvent(new CustomEvent('globalDataUpdated', { detail: null }));
                            window.location.href = `${appBasePath}/login.html?status=unapproved_admin`; 
                        }).catch((error) => {
                            console.error("AuthManager: Chyba pri odhlasovaní neschváleného administrátora:", error);
                        });
                        return; // Zastaví ďalšie spracovanie pre tohto používateľa
                    } 
                    // NOVÁ LOGIKA: Presmerovanie schválených používateľov (admin, user, hall s approved: true)
                    // ALE LEN AK SÚ NA PRIHLASOVACEJ STRÁNKE
                    else if (userProfileData.approved === true) {
                        const currentPath = window.location.pathname;
                        const targetPath = `${appBasePath}/logged-in-my-data.html`;
                        const loginPath = `${appBasePath}/login.html`; // Plná cesta k prihlasovacej stránke

                        // Presmeruje len vtedy, ak je používateľ na prihlasovacej stránke
                        if (currentPath.includes(loginPath)) { // Používame includes pre robustnosť
                            console.log("AuthManager: Schválený používateľ sa prihlásil z prihlasovacej stránky. Presmerovávam na logged-in-my-data.html.");
                            window.location.href = targetPath;
                        } else {
                            // Používateľ je schválený a NIE JE na prihlasovacej stránke,
                            // takže zostane na aktuálnej stránke.
                            console.log("AuthManager: Schválený používateľ je už prihlásený a nie je na prihlasovacej stránke. Zostávam na aktuálnej stránke.");
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
