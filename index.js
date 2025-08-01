// index.js
// Tento súbor bol upravený tak, aby bol plne samostatný a riešil potenciálne problémy
// s chybou "Minified React error #130" tým, že všetky komponenty definuje priamo v sebe.

// Pomocné komponenty pre zobrazenie stavov načítania a chýb
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md max-w-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba pri načítaní dát'),
            React.createElement('p', null, message)
        )
    );
};

// Jednoduchý Header komponent definovaný priamo tu
const Header = () => {
    // Vytvoríme jednoduché odkazy, aby sme sa vyhli závislosti na externých súboroch
    // Odkazy a ich viditeľnosť budú neskôr spravované na základe stavu používateľa
    return React.createElement(
        'header',
        { className: 'w-full text-white p-4 shadow-md fixed top-0 left-0 right-0 z-20 flex justify-between items-center transition-colors duration-300 bg-blue-800' },
        React.createElement(
            'div',
            { className: 'flex items-center space-x-6' },
            React.createElement(
                'a',
                { id: 'home-link', href: 'index.html', className: 'text-lg font-semibold hover:text-blue-200 transition-colors duration-200' },
                'Domov'
            )
        ),
        React.createElement(
            'div',
            { className: 'flex items-center space-x-6' },
            React.createElement(
                'a',
                { id: 'auth-link', href: 'login.html', className: 'text-lg font-semibold hover:text-blue-200 transition-colors duration-200' },
                'Prihlásenie'
            )
        )
    );
};


function App() {
    // Lokálny stav aplikácie
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [registrationData, setRegistrationData] = React.useState(null);
    const [countdown, setCountdown] = React.useState('');
    const [isGlobalAuthReady, setIsGlobalAuthReady] = React.useState(false);

    // Effect pre načítanie údajov z Firestore
    React.useEffect(() => {
        const fetchRegistrationData = async () => {
            console.log("App: Začínam načítavať registračné dáta...");
            try {
                // Skontrolujeme, či sú globálne premenné definované
                if (typeof __firebase_config === 'undefined' || typeof __initial_auth_token === 'undefined') {
                    console.error("Firebase config alebo auth token nie sú definované.");
                    setError("Chyba pri inicializácii Firebase. Skontrolujte prosím konfiguráciu.");
                    setLoading(false);
                    return;
                }
                const firebaseConfig = JSON.parse(__firebase_config);
                const initialAuthToken = __initial_auth_token;

                // Inicializácia Firebase
                const app = firebase.initializeApp(firebaseConfig);
                const auth = firebase.auth(app);
                const db = firebase.firestore(app);

                // Prihlásenie s custom tokenom
                await auth.signInWithCustomToken(initialAuthToken);
                console.log("App: Prihlásenie s custom tokenom úspešné.");
                
                // Načítanie globálnych dát
                const globalDataRef = db.collection('artifacts').doc('soh2025-app');
                
                const unsubscribe = globalDataRef.onSnapshot(docSnapshot => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        console.log("App: Dáta z Firestore načítané:", data);
                        setRegistrationData(data);
                    } else {
                        console.log("App: Dokument s globálnymi dátami neexistuje.");
                        setRegistrationData(null);
                    }
                    setLoading(false);
                }, err => {
                    console.error("App: Chyba pri načítavaní dát z Firestore:", err);
                    setError("Nepodarilo sa načítať registračné dáta. Skúste to neskôr.");
                    setLoading(false);
                });

                return () => unsubscribe();

            } catch (err) {
                console.error("App: Chyba v useEffect bloku:", err);
                setError("Nastala neočakávaná chyba.");
                setLoading(false);
            }
        };

        fetchRegistrationData();
    }, []);

    // Effect pre odpočet času
    React.useEffect(() => {
        if (!registrationData || !registrationData.registrationStartDate) {
            return;
        }

        const registrationStartDate = new Date(registrationData.registrationStartDate);
        const interval = setInterval(() => {
            const now = new Date();
            const distance = registrationStartDate - now;

            if (distance < 0) {
                clearInterval(interval);
                setCountdown('Registrácia je otvorená!');
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(interval);
    }, [registrationData]);

    const registrationActive = registrationData && new Date() >= new Date(registrationData.registrationStartDate) && new Date() < new Date(registrationData.registrationEndDate);
    const categoriesExist = registrationData && registrationData.categories && registrationData.categories.length > 0;

    if (loading) {
        return React.createElement(Loader, null);
    }
    
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    return (
        React.createElement('div', { className: 'bg-gray-100 min-h-screen' },
            React.createElement(Header, null),
            React.createElement(
                'main',
                { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl text-center' },
                React.createElement(
                    'h1',
                    { className: 'text-4xl font-bold mb-4 text-blue-800' },
                    'Slovak Open Handball 2025'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center mt-8' },
                    React.createElement(
                        'div',
                        { className: 'w-full' },
                        React.createElement('p', { className: 'text-xl text-gray-700' }, 'Pre pokračovanie sa, prosím, prihláste, alebo sa zaregistrujte.'),
                        React.createElement('div', { className: 'mt-6' },
                            registrationActive && categoriesExist ? (
                                React.createElement(
                                    'div',
                                    { className: 'flex justify-center space-x-4' },
                                    React.createElement(
                                        'a',
                                        { href: 'logged-in-registration.html', className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                                        'Registrovať sa'
                                    ),
                                    React.createElement(
                                        'a',
                                        { href: 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                                        'Prihlásenie'
                                    )
                                )
                            ) : (
                                React.createElement(
                                    'div',
                                    { className: 'text-center' },
                                    React.createElement('p', { className: 'text-xl text-red-600 font-semibold' }, 'Registrácia sa ešte nezačala.'),
                                    React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}

// Export pre možnosť načítania v HTML
window.App = App;
