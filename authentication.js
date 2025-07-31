// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false;
window.globalUserProfileData = null;
window.auth = null;
window.db = null;
window.showGlobalNotification = null;

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Ochrana proti zobrazeniu stránky v iframe
if (window.self !== window.top) {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.textContent = 'Táto stránka nesmie byť zobrazená v ráme (iframe).';
    errorMessageDiv.style.color = 'red';
    errorMessageDiv.style.fontSize = '20px';
    errorMessageDiv.style.textAlign = 'center';
    errorMessageDiv.style.paddingTop = '50px';
    document.body.appendChild(errorMessageDiv);
}

// Funkcia na overenie prístupu na základe roly používateľa
function checkPageAuthorization(userProfile, path) {
    // Definujte zoznam verejných stránok
    const publicPages = ['/', '/index.html', '/login.html', '/register.html'];
    if (publicPages.includes(path)) {
        return true;
    }

    // Stránky dostupné len pre prihlásených používateľov (vrátane adminov)
    const loggedInPages = ['/logged-in-my-data.html', '/logged-in-registration.html'];
    if (loggedInPages.includes(path)) {
        return userProfile !== null;
    }

    // Stránky dostupné len pre adminov
    const adminPages = ['/logged-in-admin.html']; // Príklad
    if (adminPages.includes(path)) {
        return userProfile && userProfile.role === 'admin';
    }

    // Predvolene, ak stránka nie je špecifikovaná, prístup je povolený
    return true;
}

// Inicializácia Firebase
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        if (Object.keys(firebaseConfig).length > 0) {
            const app = initializeApp(firebaseConfig);
            window.auth = getAuth(app);
            window.db = getFirestore(app);
            console.log("AuthManager: Firebase inicializované.");

            // Prihlásenie používateľa
            if (initialAuthToken) {
                await signInWithCustomToken(window.auth, initialAuthToken);
                console.log("AuthManager: Prihlásenie s vlastným tokenom prebehlo úspešne.");
            } else {
                await signInAnonymously(window.auth);
                console.log("AuthManager: Prihlásenie anonymne prebehlo úspešne.");
            }
        } else {
            console.error("AuthManager: Firebase config nebol nájdený. Inicializácia preskočená.");
        }
    } catch (error) {
        console.error("AuthManager: Chyba pri inicializácii alebo prihlásení:", error);
    }
});


// Nastavenie globálneho listenera pre zmeny stavu autentifikácie
document.addEventListener('DOMContentLoaded', () => {
    if (!window.auth) {
        console.error("AuthManager: Firebase Auth nie je inicializované. Skontrolujte inicializačný skript.");
        return;
    }

    onAuthStateChanged(window.auth, (user) => {
        window.isGlobalAuthReady = true;

        if (user) {
            console.log("AuthManager: Používateľ prihlásený, načítavam profil.");

            // KĽÚČOVÁ ZMENA: Správna cesta k profilu používateľa je 'users/{userId}'
            const userProfileRef = doc(window.db, `users/${user.uid}`);

            const unsubscribe = onSnapshot(userProfileRef, (snapshot) => {
                if (snapshot.exists()) {
                    window.globalUserProfileData = { id: snapshot.id, ...snapshot.data() };
                    console.log("AuthManager: Načítaný profil používateľa:", window.globalUserProfileData);
                } else {
                    console.warn("AuthManager: Žiadny profil používateľa nenájdený na správnej ceste 'users/{userId}'.");
                    window.globalUserProfileData = null;
                }
                
                // Kontrola autorizácie stránky po načítaní profilu
                if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                    console.warn("AuthManager: Používateľ nemá oprávnenie pre túto stránku. Presmerovanie na domovskú stránku.");
                    window.location.href = 'index.html';
                }
            }, (error) => {
                console.error("AuthManager: Chyba pri načítaní profilu:", error);
                window.globalUserProfileData = null;
            });

            // Čistenie pri odhlásení
            return () => unsubscribe();
        } else {
            console.log("AuthManager: Používateľ odhlásený.");
            window.globalUserProfileData = null;
            
            // Kontrola autorizácie stránky po odhlásení
            if (!checkPageAuthorization(window.globalUserProfileData, window.location.pathname)) {
                window.location.href = 'index.html';
            }
        }
    });

    console.log("AuthManager: Listener pre zmeny stavu autentifikácie nastavený.");
});
