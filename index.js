// index.js
// Tento súbor bol upravený tak, aby bol plne samostatný a riešil potenciálne problémy
// s chybou "Minified React error #130" tým, že všetky komponenty definuje priamo v sebe.

// Importy pre React a Firebase sú spracované priamo v HTML súbore pre zjednodušenie.

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

                // Načítanie údajov z verejnej časti databázy
                const docRef = doc(window.db, "artifacts/soh2025-2s0o2h5/public/data/registracne_udaje");
                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setRegistrationData(data);
                        console.log("Registračné dáta načítané.", data);
                        setError('');
                    } else {
                        console.warn("Registračné dáta neboli nájdené.");
                        setRegistrationData(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Chyba pri načítaní registračných dát:", err);
                    setError('Chyba pri načítaní registračných dát.');
                    setLoading(false);
                });
                
                return () => unsubscribe();

            } catch (err) {
                console.error("Všeobecná chyba:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        // Čakáme, kým bude Firebase inicializovaný
        if (window.isGlobalAuthReady) {
            fetchRegistrationData();
        } else {
            window.addEventListener('globalAuthReady', fetchRegistrationData);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
            window.removeEventListener('globalAuthReady', fetchRegistrationData);
        };
    }, []);

    // Stavy a odpočítavanie
    const [countdown, setCountdown] = React.useState('');
    const [registrationActive, setRegistrationActive] = React.useState(false);
    
    React.useEffect(() => {
        if (!registrationData || !registrationData.registrationStartDate || !registrationData.registrationEndDate) {
            return;
        }

        const registrationStartDate = new Date(registrationData.registrationStartDate.toDate());
        const registrationEndDate = new Date(registrationData.registrationEndDate.toDate());
        
        const interval = setInterval(() => {
            const now = new Date();
            const regStart = registrationStartDate.getTime();
            const regEnd = registrationEndDate.getTime();

            // Kontrola, či je registrácia aktívna
            const isRegActive = now >= regStart && now <= regEnd;
            setRegistrationActive(isRegActive);

            if (now < regStart) {
                const distance = regStart - now;
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setCountdown('Registrácia prebieha!');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [registrationData]);


    const mainContent = (() => {
        if (loading) {
            return React.createElement(LoaderComponent);
        }

        if (error) {
            return React.createElement(ErrorMessage, { message: error });
        }
        
        const regStart = registrationData ? new Date(registrationData.registrationStartDate.toDate()).getTime() : null;
        const regEnd = registrationData ? new Date(registrationData.registrationEndDate.toDate()).getTime() : null;
        const now = new Date().getTime();
        const categoriesExist = registrationData && registrationData.categories && registrationData.categories.length > 0;

        return React.createElement(
            'div',
            { className: 'p-8' },
            React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Slovak Open Handball 2025'),
            React.createElement('p', { className: 'text-xl text-gray-700' }, 'Pre pokračovanie sa, prosím, prihláste, alebo sa zaregistrujte.'),
            React.createElement(
                'div',
                { className: 'mt-8 flex justify-center space-x-4' },
                !globalUserProfileData && React.createElement(
                    'a',
                    { href: 'login.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Prihlásenie'
                ),
                !globalUserProfileData && registrationActive && categoriesExist && React.createElement(
                    'a',
                    { href: 'registration.html', className: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Registrácia'
                )
            ),
            !globalUserProfileData && React.createElement(
                'div',
                { className: 'text-center mt-6' },
                registrationActive && categoriesExist && React.createElement(
                    'p',
                    { className: 'text-lg text-green-600 font-semibold' },
                    'Registrácia je otvorená!'
                ),
                !registrationActive && categoriesExist && regStart && !isNaN(regStart) && now < regStart && React.createElement(
                    'div',
                    null,
                    React.createElement('p', { className: 'text-xl text-red-600 font-semibold' }, 'Registrácia sa ešte nezačala.'),
                    React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                ),
                !registrationActive && categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd && React.createElement(
                    'p',
                    { className: 'text-md text-gray-500 mt-2' },
                    `Registrácia skončila: ${new Date(registrationEndDate).toLocaleDateString('sk-SK')} o ${new Date(registrationEndDate).toLocaleTimeString('sk-SK')}`
                ),
                (!categoriesExist || (!regStart || !regEnd)) && React.createElement(
                    'p',
                    { className: 'text-md text-red-500 mt-2' },
                    'Registračné dáta nie sú k dispozícii. Kontaktujte administrátora.'
                )
            )
        );
    })();


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
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    }
});
