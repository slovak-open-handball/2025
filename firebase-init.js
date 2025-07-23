// firebase-init.js

// Globálne premenné pre Firebase config (očakávame, že sú definované v HTML)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase inštancie
let firebaseAppInstance;
let authInstance;
let dbInstance;

// Inicializácia Firebase (spustí sa len raz)
try {
    if (typeof firebase === 'undefined') {
        console.error("firebase-init.js: Firebase SDK nie je načítané. Uistite sa, že sú skripty Firebase SDK zahrnuté v HTML.");
    } else {
        // Skontrolujeme, či už existuje predvolená aplikácia Firebase
        if (firebase.apps.length === 0) {
            firebaseAppInstance = firebase.initializeApp(firebaseConfig);
            console.log("firebase-init.js: Firebase aplikácia inicializovaná (predvolená).");
        } else {
            firebaseAppInstance = firebase.app(); // Použite existujúcu predvolenú aplikáciu
            console.log("firebase-init.js: Používa sa existujúca predvolená Firebase aplikácia.");
        }
        authInstance = firebase.auth(firebaseAppInstance);
        dbInstance = firebase.firestore(firebaseAppInstance);
    }
} catch (e) {
    console.error("firebase-init.js: Chyba pri inicializácii Firebase:", e);
}

// Custom React Hook pre stav autentifikácie
function useAuthStatus() {
    const [user, setUser] = React.useState(undefined); // undefined = načítava sa, null = odhlásený, objekt = prihlásený
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        if (!authInstance) {
            setError("firebase-init.js: Auth inštancia nie je dostupná.");
            setLoading(false);
            return;
        }

        const unsubscribe = authInstance.onAuthStateChanged(async (currentUser) => {
            console.log("firebase-init.js: onAuthStateChanged - Používateľ:", currentUser ? currentUser.uid : "null");
            if (currentUser) {
                setUser(currentUser);
                setLoading(false);
            } else {
                // Ak nie je používateľ a existuje initialAuthToken, pokúsime sa prihlásiť
                if (initialAuthToken) {
                    try {
                        console.log("firebase-init.js: Pokúšam sa prihlásiť s initialAuthToken.");
                        await authInstance.signInWithCustomToken(initialAuthToken);
                        // onAuthStateChanged sa spustí znova s prihláseným používateľom
                    } catch (e) {
                        console.error("firebase-init.js: Chyba pri prihlásení s initialAuthToken:", e);
                        setError(`Chyba pri prihlásení s tokenom: ${e.message}`);
                        setUser(null);
                        setLoading(false);
                    }
                } else {
                    setUser(null);
                    setLoading(false);
                }
            }
        });

        return () => unsubscribe(); // Odhlásenie poslucháča pri odpojení komponentu
    }, []); // Spustí sa len raz pri pripojení komponentu

    return { user, loading, error, auth: authInstance, db: dbInstance };
}

// Export pre použitie v iných súboroch
// Ak používate Babel, môžete použiť export default alebo named exports
// Pre jednoduchosť v tomto prostredí použijeme globálne sprístupnenie
window.firebaseAuth = authInstance;
window.firebaseDb = dbInstance;
window.useAuthStatus = useAuthStatus;
