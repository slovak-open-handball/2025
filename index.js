// index.js
// Tento súbor je teraz samostatný a nespolieha sa na globálne premenné z authentication.js.
// Inicializuje Firebase a spravuje autentifikáciu sám.

// Import necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Helper function to format a Date object into 'YYYY-MM-DDTHH:mm' local string
const formatToDatetimeLocal = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Main React component for the index.html page
function App() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [user, setUser] = React.useState(null);
    const [db, setDb] = React.useState(null);
    const [auth, setAuth] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false); // Nový stav pre pripravenosť autentifikácie
    const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
    const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
    const [categoriesExist, setCategoriesExist] = React.useState(false);

    // Globálny App ID (už nie je nutný pre tieto cesty, ale pre istotu ho necháme)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Firebase initialization and authentication
    React.useEffect(() => {
        const initFirebase = async () => {
            try {
                // Používame pevnú konfiguráciu Firebase, ktorú poskytol používateľ
                const firebaseConfig = {
                    apiKey: "AIzaSyAhFyOppjWDY_zkJcuWJ2ALpb5Z1alZYy4",
                    authDomain: "soh2025-2s0o2h5.firebaseapp.com",
                    projectId: "soh2025-2s0o2h5",
                    storageBucket: "soh2025-2s0o2h5.firebasestorage.app",
                    messagingSenderId: "572988314768",
                    appId: "1:572988314768:web:781e27eb035179fe34b415"
                };

                if (!firebaseConfig.projectId) {
                    throw new Error("Firebase configuration 'projectId' is missing.");
                }

                const app = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(app);
                const firebaseAuth = getAuth(app);

                setDb(firestoreDb);
                setAuth(firebaseAuth);

                // Nastavenie listenera na zmenu stavu autentifikácie
                const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (currentUser) => {
                    try {
                        if (currentUser) {
                            setUser(currentUser);
                            console.log("User is signed in:", currentUser.uid);
                        } else {
                            console.log("User is signed out. Attempting anonymous sign-in...");
                            await signInAnonymously(firebaseAuth);
                        }
                        setIsAuthReady(true);
                    } catch (e) {
                        console.error("Authentication failed:", e);
                        setError(`Chyba pri autentifikácii: ${e.message}. Skúste obnoviť stránku.`);
                        setIsAuthReady(true);
                    }
                });
                
                const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
                if (token) {
                    await signInWithCustomToken(firebaseAuth, token);
                }

                return () => {
                    unsubscribeAuth();
                };

            } catch (e) {
                console.error("Firebase initialization failed:", e);
                setError(`Chyba pri inicializácii Firebase: ${e.message}. Skúste obnoviť stránku.`);
                setIsAuthReady(true);
            }
        };

        initFirebase();
    }, []);

    // Načítanie nastavení registrácie z Firestore, spúšťa sa, keď je Firebase a autentifikácia pripravená
    React.useEffect(() => {
        if (!db || !isAuthReady) {
            console.log("App: Waiting for Firebase db and authentication to be ready...");
            return;
        }

        console.log("App: Firebase db and authentication are ready, fetching registration settings.");
        try {
            // Správna cesta k dokumentu
            // Cesta: settings/registration
            const settingsRef = doc(db, 'settings', 'registration');
            const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setRegistrationStartDate(data.registrationStartDate ? data.registrationStartDate.toDate() : null);
                    setRegistrationEndDate(data.registrationEndDate ? data.registrationEndDate.toDate() : null);
                } else {
                    console.log("No such settings document!");
                    setRegistrationStartDate(null);
                    setRegistrationEndDate(null);
                }
                setLoading(false);
            }, (err) => {
                console.error("Error getting settings document:", err);
                setError("Chyba pri načítaní nastavení. Skúste obnoviť stránku.");
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Chyba pri nastavení listenera pre nastavenia:", e);
            setError("Chyba pri inicializácii načítania nastavení. Skúste obnoviť stránku.");
            setLoading(false);
        }
    }, [db, isAuthReady, appId]);

    // Kontrola existencie kategórií, spúšťa sa, keď sú načítané dátumy registrácie
    React.useEffect(() => {
        const checkCategories = async () => {
            if (!db || !isAuthReady) {
                console.log("App: Waiting for Firebase to be ready before checking categories.");
                return;
            }
            console.log("App: Checking for categories...");
            try {
                // Opravená cesta ku kolekcii
                // Cesta: categories (na rovnakej úrovni ako "settings")
                const categoriesCollectionRef = collection(db, 'categories');
                const categoriesSnap = await getDocs(categoriesCollectionRef);
                setCategoriesExist(!categoriesSnap.empty);
            } catch (e) {
                console.error("Chyba pri kontrole kategórií:", e);
            }
        };

        if (registrationStartDate && registrationEndDate) {
            checkCategories();
        }
    }, [registrationStartDate, registrationEndDate, db, isAuthReady, appId]);


    // Funkcia na výpočet odpočtu
    const [countdown, setCountdown] = React.useState('');
    React.useEffect(() => {
        if (!registrationStartDate) return;

        const interval = setInterval(() => {
            const now = new Date();
            const start = new Date(registrationStartDate);
            const diff = start.getTime() - now.getTime();

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setCountdown('');
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [registrationStartDate]);


    // Zobrazenie načítania, chyby alebo obsahu stránky
    if (loading) {
        return (
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-screen' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900' })
            )
        );
    }

    if (error) {
        return (
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-screen' },
                React.createElement('p', { className: 'text-red-500' }, error)
            )
        );
    }

    const now = new Date().getTime();
    const regStart = registrationStartDate ? registrationStartDate.getTime() : null;
    const regEnd = registrationEndDate ? registrationEndDate.getTime() : null;
    const registrationActive = categoriesExist && regStart && regEnd && now >= regStart && now <= regEnd;

    return (
        React.createElement('div', { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center' },
            React.createElement('main', { className: 'p-8 flex-grow flex items-center justify-center' },
                React.createElement('div', { className: 'container mx-auto p-4' },
                    React.createElement('div', { className: 'bg-white p-6 rounded-lg shadow-xl text-center max-w-2xl mx-auto' },
                        React.createElement('h1', { className: 'text-4xl font-bold text-gray-800' }, 'Vitajte na SOH 2025!'),
                        React.createElement('p', { className: 'text-lg text-gray-600 mt-4' }, 'Slovak Open Handball 2025 sa blíži! Pripravte sa na najväčší hádzanársky turnaj na Slovensku.'),
                        React.createElement('div', { className: 'mt-8' },
                            registrationActive && (
                                React.createElement(
                                    'p',
                                    { className: 'text-xl text-green-600 font-semibold' },
                                    'Registrácia prebieha!',
                                    React.createElement('br', null),
                                    React.createElement('span', { className: 'text-lg text-gray-500' },
                                        `Registrácia končí: ${new Date(registrationEndDate).toLocaleDateString('sk-SK')} o ${new Date(registrationEndDate).toLocaleTimeString('sk-SK')}`
                                    )
                                )
                            ),
                            !registrationActive && categoriesExist && regStart && !isNaN(regStart) && now < regStart && (
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement(
                                        'p',
                                        { className: 'text-xl text-red-600 font-semibold' },
                                        'Registrácia sa ešte nezačala.'
                                    ),
                                    React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                                )
                            ),
                            categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd && (
                                React.createElement(
                                    'p',
                                    { className: 'text-md text-gray-500 mt-2' },
                                    'Registrácia skončila:',
                                    ' ',
                                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleDateString('sk-SK')),
                                    ' ',
                                    React.createElement('span', { style: { whiteSpace: 'nowrap' } }, new Date(registrationEndDate).toLocaleTimeString('sk-SK'))
                                )
                            ),
                            React.createElement(
                                'div',
                                { className: 'mt-6 flex justify-center' },
                                React.createElement(
                                    'a',
                                    {
                                        href: 'login.html',
                                        className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200'
                                    },
                                    'Prihlásenie'
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.render(React.createElement(App), rootElement);
} else {
    console.error("Failed to find the root element to render the application.");
}
