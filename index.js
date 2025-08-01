// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.

// Potrebné ikony z lucide-react sú dostupné globálne cez CDN.
const { Menu, User, LogIn, LogOut, Loader, X, ChevronDown, Check, UserPlus } = LucideReact;

// Pomocné komponenty pre zobrazenie stavov načítania a chýb
const LoaderComponent = () => {
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

// Jednoduchý Header komponent definovaný priamo tu.
const Header = () => {
    // Použijeme globálne dáta pre zobrazenie odkazov.
    const userProfile = window.globalUserProfileData;

    return React.createElement(
        'header',
        { className: 'bg-white shadow-md rounded-b-lg sticky top-0 z-50' },
        React.createElement(
            'nav',
            { className: 'container mx-auto p-4 flex justify-between items-center' },
            React.createElement(
                'div',
                { className: 'flex items-center space-x-2' },
                React.createElement('img', { src: 'https://placehold.co/40x40/0A2C49/white?text=SOH', alt: 'Logo SOH 2025', className: 'h-10 w-10 rounded-full' }),
                React.createElement('a', { href: 'index.html', className: 'text-2xl font-bold text-gray-800' }, 'SOH 2025')
            ),
            React.createElement(
                'div',
                { className: 'hidden md:flex space-x-6 items-center' },
                React.createElement('a', { href: 'index.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Domov'),
                // Zobrazíme "Registrácia" alebo "Moja zóna" na základe prihlásenia
                userProfile ? (
                    React.createElement('a', { href: 'logged-in-my-data.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Moja zóna')
                ) : (
                    React.createElement('a', { href: 'registration.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Registrácia')
                ),
                React.createElement('a', { href: userProfile ? 'logged-in-my-data.html' : 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' }, userProfile ? 'Môj profil' : 'Prihlásenie')
            )
        )
    );
};

// Hlavný komponent aplikácie
const App = () => {
    const [registrationData, setRegistrationData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [globalUserProfileData, setGlobalUserProfileData] = React.useState(window.globalUserProfileData);
    const [countdown, setCountdown] = React.useState('');

    // Efekt pre načítanie registračných dát a nastavenie listenra
    React.useEffect(() => {
        const fetchRegistrationData = () => {
            if (!window.db) {
                setError("Firestore nie je inicializovaný. Skontrolujte authentication.js.");
                setLoading(false);
                return () => {}; // Vrátime prázdnu funkciu pre čistenie
            }

            const docRef = doc(window.db, "artifacts", "soh2025-2s0o2h5");
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    setRegistrationData(docSnap.data());
                } else {
                    console.log("Dokument s registračnými dátami neexistuje.");
                    setRegistrationData(null);
                }
                setLoading(false);
            }, (err) => {
                console.error("Chyba pri načítaní registračných dát:", err);
                setError("Chyba pri načítaní registračných dát. Skúste to neskôr.");
                setLoading(false);
            });

            // Čistiaca funkcia pre listener
            return () => unsubscribe();
        };

        const unsubscribe = fetchRegistrationData();

        // Uistíme sa, že po zmenách globálnych dát sa aktualizuje aj lokálny stav
        const handleGlobalDataUpdate = (event) => {
            setGlobalUserProfileData(window.globalUserProfileData);
        };
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        return () => {
            unsubscribe();
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []); // Prázdne pole závislostí zabezpečí, že sa efekt spustí len raz

    // Efekt pre odpočítavanie času
    React.useEffect(() => {
        let timer = null;
        if (registrationData && registrationData.registrationStart) {
            const regStart = registrationData.registrationStart.toMillis();
            timer = setInterval(() => {
                const now = Date.now();
                const diff = regStart - now;
                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
                } else {
                    setCountdown('Registrácia začala!');
                    clearInterval(timer);
                }
            }, 1000);
        }

        // Čistiaca funkcia pre timer
        return () => clearInterval(timer);
    }, [registrationData]); // Tento efekt sa spustí len pri zmene registrationData

    // Vykresľovanie na základe stavu aplikácie
    if (loading) {
        return React.createElement(LoaderComponent, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    // Získanie dát z registrationData
    const now = Date.now();
    const regStart = registrationData?.registrationStart?.toMillis();
    const regEnd = registrationData?.registrationEnd?.toMillis();
    const registrationActive = regStart && regEnd && now >= regStart && now <= regEnd;
    const categoriesExist = registrationData?.categories && registrationData.categories.length > 0;

    let mainContent;

    if (!categoriesExist || !regStart || !regEnd) {
        mainContent = React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Slovak Open Handball 2025'),
            React.createElement('p', { className: 'text-xl text-gray-700' }, 'Registračné dáta nie sú k dispozícii. Skúste to, prosím, neskôr.')
        );
    } else {
        if (registrationActive) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia je otvorená!'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, 'Registrácia pre Slovak Open Handball 2025 je už spustená.'),
                React.createElement(
                    'div',
                    { className: 'mt-8 flex justify-center space-x-4' },
                    React.createElement(
                        'a',
                        { href: 'registration.html', className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                        'Registrovať sa'
                    ),
                    React.createElement(
                        'a',
                        { href: 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                        'Prihlásenie'
                    )
                )
            );
        } else if (now < regStart) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia sa ešte nezačala.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, `Registrácia začne o: ${countdown}`)
            );
        } else { // now > regEnd
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia skončila.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, 'Registračný proces pre tento rok bol už ukončený.')
            );
        }
    }

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(Header, null),
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
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App, null));
    }
});
