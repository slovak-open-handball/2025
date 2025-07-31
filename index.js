// index.js
// Tento súbor predpokladá, že Firebase SDK je inicializovaný v <head> index.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Importujeme potrebné Firebase funkcie. Tieto je potrebné explicitne naimportovať,
// aj keď je hlavná inštancia Firebase dostupná cez globálne premenné.
import { doc, onSnapshot, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Helper funkcia na formátovanie objektu Date do 'YYYY-MM-DDTHH:mm'
const formatToDatetimeLocal = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Hlavný React komponent pre stránku index.html
function App() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [user, setUser] = React.useState(null);
    const [registrationStartDate, setRegistrationStartDate] = React.useState(null);
    const [registrationEndDate, setRegistrationEndDate] = React.useState(null);
    const [categoriesExist, setCategoriesExist] = React.useState(false);
    
    // Globálny App ID
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Počúvanie na zmeny stavu autentifikácie a aktualizácia stavu používateľa
    React.useEffect(() => {
        const handleAuthStateChange = () => {
            console.log("App: auth-state-changed event received.");
            if (window.isGlobalAuthReady) {
                setUser(window.globalUserProfileData);
                // Tu môžete spustiť ďalšiu logiku, ktorá závisí od prihlásenia
            } else {
                setUser(null);
            }
        };

        // Spustíme logiku, ak je už stav pripravený pri prvom vykreslení
        if (window.isGlobalAuthReady) {
            handleAuthStateChange();
        }

        window.addEventListener('auth-state-changed', handleAuthStateChange);
        return () => {
            window.removeEventListener('auth-state-changed', handleAuthStateChange);
        };
    }, []);

    // Načítanie nastavení registrácie z Firestore, spúšťa sa, keď je Firebase pripravený
    React.useEffect(() => {
        if (!window.isGlobalAuthReady || !window.db) {
            console.log("App: Waiting for Firebase to be ready...");
            return;
        }

        console.log("App: Firebase je pripravené, načítavam nastavenia registrácie.");
        try {
            const settingsRef = doc(window.db, 'artifacts', appId, 'public', 'settings');
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
    }, [window.isGlobalAuthReady, window.db, appId]); // Závislosti zabezpečia, že sa spustí, až keď sú služby pripravené

    // Kontrola existencie kategórií, spúšťa sa, keď sú načítané dátumy registrácie
    React.useEffect(() => {
        const checkCategories = async () => {
            if (!window.db || !window.isGlobalAuthReady) {
                console.log("App: Waiting for Firebase to be ready before checking categories.");
                return;
            }
            console.log("App: Checking for categories...");
            try {
                const categoriesCollectionRef = collection(window.db, 'artifacts', appId, 'public', 'categories');
                const categoriesSnap = await getDocs(categoriesCollectionRef);
                setCategoriesExist(!categoriesSnap.empty);
            } catch (e) {
                console.error("Chyba pri kontrole kategórií:", e);
            }
        };

        if (registrationStartDate && registrationEndDate) {
            checkCategories();
        }
    }, [registrationStartDate, registrationEndDate, window.isGlobalAuthReady, window.db, appId]);


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
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(App));
} else {
    console.error("Failed to find the root element to render the application.");
}
