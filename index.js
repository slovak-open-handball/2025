import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Potrebné ikony z lucide-react
const { Menu, User, LogIn } = LucideReact;

// Komponent Header
const Header = () => {
    return (
        <header className="bg-white shadow-md rounded-b-lg sticky top-0 z-50">
            <nav className="container mx-auto p-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <img src="https://placehold.co/40x40/0A2C49/white?text=SOH" alt="Logo SOH 2025" className="h-10 w-10 rounded-full" />
                    <a href="index.html" className="text-2xl font-bold text-gray-800">SOH 2025</a>
                </div>
                <div className="hidden md:flex space-x-6 items-center">
                    <a href="index.html" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Domov</a>
                    <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Turnaj</a>
                    <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">Tímy</a>
                    <a href="login.html" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors duration-200">
                        <LogIn size={20} />
                        <span>Prihlásenie</span>
                    </a>
                </div>
                <div className="md:hidden">
                    <button className="text-gray-600 hover:text-gray-900">
                        <Menu size={24} />
                    </button>
                </div>
            </nav>
        </header>
    );
};

const formatToDatetimeLocal = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

function App() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [user, setUser] = React.useState(null);
    const [db, setDb] = React.useState(null);
    const [auth, setAuth] = React.useState(null);
    const [isAuthReady, setIsAuthReady] = React.useState(false);
    const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
    const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
    const [categoriesExist, setCategoriesExist] = React.useState(false);

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    React.useEffect(() => {
        const initFirebase = async () => {
            try {
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

    React.useEffect(() => {
        if (!db || !isAuthReady) {
            console.log("App: Waiting for Firebase db and authentication to be ready...");
            return;
        }

        console.log("App: Firebase db and authentication are ready, fetching registration settings.");
        try {
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
                if (err.code === 'permission-denied') {
                    console.error("Chyba pri načítaní nastavení: Nedostatočné oprávnenia. Skontrolujte vaše Firebase Security Rules.", err);
                    setError("Chyba pri načítaní nastavení. Skontrolujte bezpečnostné pravidlá vo vašej databáze.");
                } else {
                    console.error("Chyba pri načítaní nastavení dokumentu:", err);
                    setError("Chyba pri načítaní nastavení. Skúste obnoviť stránku.");
                }
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Chyba pri nastavení listenera pre nastavenia:", e);
            setError("Chyba pri inicializácii načítania nastavení. Skúste obnoviť stránku.");
            setLoading(false);
        }
    }, [db, isAuthReady, appId]);

    React.useEffect(() => {
        const checkCategories = async () => {
            if (!db || !isAuthReady) {
                console.log("App: Waiting for Firebase to be ready before checking categories.");
                return;
            }
            console.log("App: Checking for categories...");
            try {
                const categoriesCollectionRef = collection(db, 'categories');
                const categoriesSnap = await getDocs(categoriesCollectionRef);
                setCategoriesExist(!categoriesSnap.empty);
            } catch (e) {
                if (e.code === 'permission-denied') {
                    console.error("Chyba pri kontrole kategórií: Nedostatočné oprávnenia. Skontrolujte vaše Firebase Security Rules.", e);
                } else {
                    console.error("Chyba pri kontrole kategórií:", e);
                }
            }
        };

        if (registrationStartDate && registrationEndDate) {
            checkCategories();
        }
    }, [registrationStartDate, registrationEndDate, db, isAuthReady, appId]);

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


    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    const now = new Date().getTime();
    const regStart = registrationStartDate ? registrationStartDate.getTime() : null;
    const regEnd = registrationEndDate ? registrationEndDate.getTime() : null;
    const registrationActive = categoriesExist && regStart && regEnd && now >= regStart && now <= regEnd;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center p-8">
                <div className="container mx-auto p-4">
                    <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-2xl mx-auto">
                        <h1 className="text-4xl font-bold text-gray-800">Vitajte na SOH 2025!</h1>
                        <p className="text-lg text-gray-600 mt-4">Slovak Open Handball 2025 sa blíži! Pripravte sa na najväčší hádzanársky turnaj na Slovensku.</p>
                        <div className="mt-8">
                            {registrationActive && (
                                <div>
                                    <p className="text-xl text-green-600 font-semibold">Registrácia prebieha!</p>
                                    <p className="text-lg text-gray-500">Registrácia končí: {new Date(registrationEndDate).toLocaleDateString('sk-SK')} o {new Date(registrationEndDate).toLocaleTimeString('sk-SK')}</p>
                                    <div className="mt-6">
                                        <a href="login.html" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200">Prihlásenie</a>
                                    </div>
                                </div>
                            )}
                            {!registrationActive && categoriesExist && regStart && !isNaN(regStart) && now < regStart && (
                                <div>
                                    <p className="text-xl text-red-600 font-semibold">Registrácia sa ešte nezačala.</p>
                                    <p className="text-md text-gray-500 mt-2">Registrácia začne o: {countdown}</p>
                                </div>
                            )}
                            {!registrationActive && categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd && (
                                <p className="text-md text-gray-500 mt-2">Registrácia skončila: {new Date(registrationEndDate).toLocaleDateString('sk-SK')} o {new Date(registrationEndDate).toLocaleTimeString('sk-SK')}</p>
                            )}
                            {(!categoriesExist || (!regStart || !regEnd)) && (
                                <p className="text-md text-red-500 mt-2">Registračné dáta nie sú k dispozícii. Kontaktujte administrátora.</p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
