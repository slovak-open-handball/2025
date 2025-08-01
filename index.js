// index.js
// Tento súbor bol upravený tak, aby bol plne samostatný a riešil potenciálne problémy
// s chybou "Minified React error #130" tým, že všetky komponenty definuje priamo v sebe.

// Importy pre React a Firebase sú spracované priamo v HTML súbore pre zjednodušenie.

// Potrebné ikony z lucide-react sú dostupné globálne cez CDN.
const { Menu, User, LogIn, LogOut, Loader, X, ChevronDown, Check, UserPlus } = LucideReact;

// Hlavný komponent aplikácie
const App = () => {
    const [registrationData, setRegistrationData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [globalUserProfileData, setGlobalUserProfileData] = React.useState(window.globalUserProfileData);

    // Načítanie registračných dát
    React.useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            setGlobalUserProfileData(event.detail);
        };
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        const fetchRegistrationData = async () => {
            try {
                if (!window.db) {
                    throw new Error("Firestore nie je inicializovaný.");
                }

                const docRef = doc(window.db, "artifacts", "soh2025-2s0o2h5");
                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setRegistrationData(data);
                        setError('');
                    } else {
                        setError("Registračné dáta sa nenašli.");
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Chyba pri načítavaní registračných dát:", err);
                    setError("Chyba pri načítavaní registračných dát.");
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (err) {
                console.error("Chyba pri nastavovaní listenera:", err);
                setError("Chyba pri inicializácii.");
                setLoading(false);
            }
        };

        if (window.isGlobalAuthReady) {
            fetchRegistrationData();
        } else {
            const authReadyListener = () => {
                fetchRegistrationData();
                window.removeEventListener('globalAuthReady', authReadyListener);
            };
            window.addEventListener('globalAuthReady', authReadyListener);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Skryjeme globálny loader, keď je aplikácia pripravená
    React.useEffect(() => {
        if (!loading) {
            window.hideGlobalLoader();
        }
    }, [loading]);

    if (error) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement(
                'div',
                { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md max-w-md' },
                React.createElement('p', { className: 'font-bold' }, 'Chyba pri načítaní dát'),
                React.createElement('p', null, error)
            )
        );
    }
    
    // Zobrazenie hlavného obsahu
    const { registrationStart, registrationEnd, registrationOpen } = registrationData || {};
    const now = new Date().getTime();
    const registrationActive = registrationOpen && registrationStart && registrationEnd && now >= registrationStart && now <= registrationEnd;
    
    // Obsah pre prihlásených a neprihlásených používateľov
    const mainContent = globalUserProfileData ? (
        React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement(
                'h2',
                { className: 'text-3xl font-bold mb-4 text-blue-600' },
                `Vitajte, ${globalUserProfileData.firstName || 'používateľ'}!`
            ),
            React.createElement(
                'p',
                { className: 'text-xl text-gray-700' },
                'Použite menu v hlavičke na prechod do vašej zóny alebo na registráciu do turnaja.'
            )
        )
    ) : (
        React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement(
                'h2',
                { className: 'text-3xl font-bold mb-4 text-blue-600' },
                'Vitajte na Slovak Open Handball 2025'
            ),
            React.createElement(
                'p',
                { className: 'text-xl text-gray-700' },
                'Pre pokračovanie sa, prosím, prihláste alebo sa zaregistrujte.'
            ),
            React.createElement(
                'div',
                { className: 'mt-8 flex justify-center space-x-4' },
                React.createElement(
                    'a',
                    { href: 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Prihlásenie'
                ),
                registrationActive && React.createElement(
                    'a',
                    { href: 'registration.html', className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Registrácia'
                )
            )
        )
    );

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col' },
        React.createElement(
            'main',
            { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl flex-grow flex items-center justify-center' },
            mainContent
        )
    );
};

// Export pre možnosť načítania v HTML
window.App = App;

// Vykreslí aplikáciu až po načítaní DOM a skryje loader
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('root')) {
        ReactDOM.createRoot(document.getElementById('root')).render(
            React.createElement(App)
        );
    }
});
