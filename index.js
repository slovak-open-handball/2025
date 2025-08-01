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
                    {/* ... ďalšie navigačné odkazy */}
                </div>
                <div className="md:hidden">
                    <button className="text-gray-600 hover:text-gray-900">
                        <Menu className="h-6 w-6" />
                    </button>
                </div>
            </nav>
        </header>
    );
};

// Hlavný komponent stránky
function App() {
    const [registrationData, setRegistrationData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        // Inicializácia Firebase a prihlásenie
        const initFirebase = async () => {
            try {
                const firebaseConfig = JSON.parse(window.__firebase_config);
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const db = getFirestore(app);
                window.db = db; // Nastavenie globálnej premennej

                if (typeof window.__initial_auth_token !== 'undefined') {
                    await signInWithCustomToken(auth, window.__initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }

                // Listener pre zmeny stavu registračných dát
                const registrationDocRef = doc(db, "artifacts", window.__app_id, "public", "data", "registration");
                onSnapshot(registrationDocRef, (doc) => {
                    if (doc.exists()) {
                        setRegistrationData(doc.data());
                    } else {
                        setError("Registračné dáta neboli nájdené.");
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Chyba pri načítaní registračných dát:", err);
                    setError("Nepodarilo sa načítať registračné dáta.");
                    setLoading(false);
                });

            } catch (err) {
                console.error("Chyba pri inicializácii Firebase alebo prihlásení:", err);
                setError("Chyba pri inicializácii aplikácie.");
                setLoading(false);
            }
        };

        if (typeof window.__firebase_config !== 'undefined' && window.__firebase_config) {
            initFirebase();
        } else {
            console.warn("Firebase konfigurácia nie je dostupná. Dáta sa nenačítajú.");
            setError("Firebase konfigurácia nie je dostupná.");
            setLoading(false);
        }

    }, []);

    const categoriesExist = registrationData && registrationData.categories && registrationData.categories.length > 0;
    const registrationStartDate = registrationData ? registrationData.start_date : null;
    const registrationEndDate = registrationData ? registrationData.end_date : null;
    const isRegistrationOpen = registrationStartDate && registrationEndDate && (Date.now() >= new Date(registrationStartDate).getTime()) && (Date.now() <= new Date(registrationEndDate).getTime());
    
    // Nový stav a efekt pre odpočítavanie
    const [countdown, setCountdown] = React.useState('');
    React.useEffect(() => {
        if (!registrationStartDate || !registrationEndDate) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const regStart = new Date(registrationStartDate).getTime();
            const regEnd = new Date(registrationEndDate).getTime();

            if (now < regStart) {
                const distance = regStart - now;
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setCountdown('');
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [registrationStartDate, registrationEndDate]);


    if (loading) {
        // Používame globálne definovaný komponent Loader
        return React.createElement(window.Loader, null);
    }

    if (error) {
        return React.createElement(
            'div',
            { className: 'text-center p-8 text-red-500' },
            React.createElement('p', null, error)
        );
    }

    return (
        React.createElement('div', { className: 'bg-gray-100 min-h-screen' },
            React.createElement(Header, null),
            React.createElement('main', { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Slovak Open Handball 2025'),
                React.createElement('div', { className: 'mt-8' },
                    isRegistrationOpen && categoriesExist ? (
                        React.createElement('div', null,
                            React.createElement('p', { className: 'text-xl text-green-600 font-semibold mb-4' }, 'Registrácia je otvorená!'),
                            React.createElement('a', { href: 'logged-in-registration.html', className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200' }, 'Prejsť na registráciu')
                        )
                    ) : (
                        React.createElement('div', null,
                            React.createElement('p', { className: 'text-xl text-gray-700 mb-4' }, 'Pre pokračovanie sa, prosím, prihláste.'),
                            React.createElement('div', { className: 'flex justify-center space-x-4' },
                                React.createElement('a', { href: 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' }, 'Prihlásenie'),
                                React.createElement('a', { href: 'registration.html', className: 'bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' }, 'Registrácia')
                            )
                        )
                    )
                )
            )
        )
    );
}

export default App;
