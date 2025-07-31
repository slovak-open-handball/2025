// authentication.js
// Tento súbor spravuje globálnu autentifikáciu Firebase, načítanie profilových dát používateľa,
// overovanie prístupu a nastavenie globálnych premenných pre celú aplikáciu.

// Importy pre Firebase SDK musia byť explicitne definované pre moduly
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Opravil som importy pre Firestore tak, aby obsahovali aj `collection`.
import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Globálne premenné, ktoré budú dostupné pre všetky ostatné skripty
window.isGlobalAuthReady = false;
window.globalUserProfileData = null;
window.auth = null;
window.db = null;
window.showGlobalNotification = null;

// Statická konfigurácia Firebase pre prípad, že globálna premenná nie je k dispozícii
const staticFirebaseConfig = {
    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
    projectId: "soh2025-2s0o2h5",
    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
    messagingSenderId: "572988314768",
    appId: "1:572988314768:web:781e27eb035179fe34b415"
};

// Inicializácia Firebase
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' && Object.keys(JSON.parse(__firebase_config)).length > 0
    ? JSON.parse(__firebase_config)
    : staticFirebaseConfig;

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Defenzívna kontrola, či je konfigurácia Firebase platná
if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
    console.error("AuthManager: Globálna premenná __firebase_config je prázdna alebo neplatná. Firebase nemôže byť inicializovaný.");
} else {
    try {
        const app = initializeApp(firebaseConfig);
        window.auth = getAuth(app);
        window.db = getFirestore(app);

    } catch (e) {
        console.error("AuthManager: Chyba pri inicializácii Firebase. Skontrolujte konfiguráciu.", e);
    }
}

// Funkcia na overenie a prihlásenie pomocou custom tokenu alebo anonymne
const authenticateUser = async () => {
    if (!window.auth) {
        console.error("AuthManager: Firebase Auth nie je inicializovaný. Preskakujem autentifikáciu.");
        return;
    }
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(window.auth, initialAuthToken);
            console.log("AuthManager: Prihlásenie pomocou custom tokenu úspešné.");
        } else {
            await signInAnonymously(window.auth);
            console.log("AuthManager: Prihlásenie anonymne úspešné.");
        }
    } catch (error) {
        console.error("AuthManager: Chyba pri autentifikácii:", error);
        if (window.auth) {
            await signInAnonymously(window.auth);
        }
    }
};

// Helper funkcia pre autorizáciu prístupu k stránkam
const checkPageAuthorization = (userData, currentPath) => {
    const pageAccessRules = {
        'index.html': { role: 'public', approved: true },
        'login.html': { role: 'public', approved: true },
        'account.html': { role: 'user', approved: true },
        'admin-register.html': { role: 'public', approved: true }, 
        'register.html': { role: 'user', approved: true },
        'logged-in-users.html': { role: 'admin', approved: true },
        'logged-in-tournament-settings.html': { role: 'admin', approved: true },
        'logged-in-add-categories.html': { role: 'admin', approved: true },
        'logged-in-all-registrations.html': { role: 'admin', approved: true },
        'logged-in-my-data.html': { role: 'user', approved: true },
        'logged-in-my-team.html': { role: 'user', approved: true },
        'logged-in-registrations.html': { role: 'user', approved: true },
        'logged-in-team-settings.html': { role: 'user', approved: true },
        'logged-in-create-team.html': { role: 'user', approved: true },
    };

    const page = currentPath.substring(currentPath.lastIndexOf('/') + 1);
    const rule = pageAccessRules[page];

    if (!rule) {
        console.log(`AuthManager: Žiadne pravidlo pre stránku ${page}. Prístup povolený.`);
        return true;
    }
    
    if (rule.role === 'public') {
        console.log(`AuthManager: Stránka ${page} je verejná. Prístup povolený.`);
        return true;
    }
    
    if (!userData) {
        console.log(`AuthManager: Používateľ je odhlásený a stránka ${page} nie je verejná. Presmerujem na login.`);
        return false;
    }

    if (userData.role === rule.role && userData.approved === rule.approved) {
        console.log(`AuthManager: Prístup k stránke ${page} povolený pre rolu ${userData.role}.`);
        return true;
    } else if (userData.role === 'admin' && rule.role === 'user' && rule.approved) {
        console.log(`AuthManager: Admin prístup k stránke ${page} povolený.`);
        return true;
    }

    console.log(`AuthManager: Prístup k stránke ${page} odmietnutý pre rolu ${userData.role}.`);
    return false;
};

const redirectToHome = () => {
    window.location.href = 'index.html';
};

// Vytvorenie a správa globálnych notifikácií
const { useEffect, useState } = React;
const GlobalNotificationHandler = () => {
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');
    const [error, setError] = useState('');
    
    useEffect(() => {
        window.showGlobalNotification = (msg, type = 'info', err = '') => {
            setMessage(msg);
            setMessageType(type);
            setError(err);
            setTimeout(() => {
                setMessage('');
                setError('');
            }, 5000);
        };
    }, []);

    return React.createElement(
        'div',
        {
            className: `fixed top-0 left-0 right-0 z-[999] flex justify-center p-4 transition-transform duration-500 ease-out ${
                (message || error) ? 'translate-y-0' : '-translate-y-full'
            }`,
            style: { pointerEvents: 'none' }
        },
        React.createElement(
            'div',
            {
                className: `${messageType === 'success' ? 'bg-[#3A8D41]' : messageType === 'error' ? 'bg-red-600' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg max-w-md w-full text-center`,
                style: { pointerEvents: 'auto' }
            },
            React.createElement('p', { className: 'font-semibold' }, message || error)
        )
    );
};

// Vykreslíme GlobalNotificationHandler do skrytého DOM elementu
let authRoot = document.getElementById('authentication-root');
if (!authRoot) {
    authRoot = document.createElement('div');
    authRoot.id = 'authentication-root';
    authRoot.style.display = 'none';
    document.body.appendChild(authRoot);
}

try {
    // OPRAVA: Použitie createRoot namiesto render pre React 18
    const root = ReactDOM.createRoot(authRoot);
    root.render(React.createElement(GlobalNotificationHandler));
} catch (e) {
    console.error("AuthManager: Chyba pri vykreslení GlobalNotificationHandler:", e);
}

// Pridáme logiku pre kontrolu autorizácie pri zmene stavu autentifikácie
// Uistíme sa, že onAuthStateChanged sa zavolá iba ak je auth inicializované
if (window.auth) {
    onAuthStateChanged(window.auth, async (user) => {
        console.log("AuthManager: Stav autentifikácie sa zmenil.", user);

        let profileData = null;
        if (user) {
            const userDocRef = doc(window.db, 'users', user.uid);
            try {
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    profileData = userDoc.data();
                } else {
                    console.log("AuthManager: Dokument používateľa neexistuje, nastavujem defaultný profil.");
                    profileData = { role: 'user', approved: false, email: user.email };
                }
            } catch (e) {
                console.error("AuthManager: Chyba pri načítavaní profilu používateľa:", e);
            }
        }
        
        window.globalUserProfileData = profileData;
        window.isGlobalAuthReady = true;

        // Odpálime udalosť, aby ostatné skripty vedeli, že sa môžu spustiť
        window.dispatchEvent(new Event('auth-state-changed'));

        const currentPath = window.location.pathname;
        const isAuthorized = checkPageAuthorization(window.globalUserProfileData, currentPath);

        if (!isAuthorized) {
            if (!user) {
                window.location.href = 'login.html';
            } else {
                redirectToHome();
            }
        }
    });

    authenticateUser();
} else {
    console.warn("AuthManager: Firebase auth nebol inicializovaný, onAuthStateChanged sa nespustí.");
}
