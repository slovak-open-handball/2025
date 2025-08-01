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

// Jednoduchý Header komponent definovaný priamo tu
const Header = ({ globalUserProfileData, registrationActive, handleLogout }) => {
    const navLinks = [];
    if (globalUserProfileData) {
        navLinks.push(
            React.createElement('a', { key: 'my-zone', href: 'logged-in-my-data.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Moja zóna'),
            React.createElement('button', { key: 'logout', onClick: handleLogout, className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Odhlásenie')
        );
    } else {
        navLinks.push(
            React.createElement('a', { key: 'login', href: 'login.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Prihlásenie')
        );
        if (registrationActive) {
            navLinks.push(
                React.createElement('a', { key: 'register', href: 'registration.html', className: 'text-gray-600 hover:text-gray-900 transition-colors duration-200' }, 'Registrácia na turnaj')
            );
        }
    }

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
                ...navLinks
            ),
            React.createElement(
                'div',
                { className: 'md:hidden' },
                React.createElement('button', { onClick: () => alert('Menu clicked') }, React.createElement(Menu, { className: 'h-6 w-6' }))
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

    // Funkcia na výpočet odpočtu
    const calculateCountdown = (date) => {
        const now = new Date().getTime();
        const distance = date - now;
        if (distance < 0) {
            return null;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    };

    // Načítanie registračných dát a užívateľského profilu
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

                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const docRef = doc(window.db, "artifacts", appId);

                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setRegistrationData(data);
                        setLoading(false);
                    } else {
                        setError('Registračné dáta neboli nájdené.');
                        setLoading(false);
                    }
                }, (err) => {
                    console.error("Chyba pri načítaní registračných dát:", err);
                    setError('Chyba pri načítaní registračných dát. Skúste to prosím znova.');
                    setLoading(false);
                });

                return () => {
                    unsubscribe();
                    window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
                };
            } catch (err) {
                console.error("Chyba pri inicializácii načítania dát:", err);
                setError('Nepodarilo sa načítať registračné dáta. Skontrolujte pripojenie.');
                setLoading(false);
            }
        };

        fetchRegistrationData();
    }, []);

    // Effect pre časovač
    React.useEffect(() => {
        if (!registrationData || !registrationData.registrationStartDate) {
            return;
        }

        const regStart = new Date(registrationData.registrationStartDate).getTime();
        const now = new Date().getTime();

        if (now < regStart) {
            const timer = setInterval(() => {
                setCountdown(calculateCountdown(regStart));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [registrationData]);

    const registrationStartDate = registrationData?.registrationStartDate;
    const registrationEndDate = registrationData?.registrationEndDate;
    const categoriesExist = registrationData?.categories?.length > 0;
    const now = new Date().getTime();

    const regStart = registrationStartDate ? new Date(registrationStartDate).getTime() : null;
    const regEnd = registrationEndDate ? new Date(registrationEndDate).getTime() : null;
    const registrationActive = categoriesExist && regStart && regEnd && now >= regStart && now <= regEnd;

    if (loading) {
        return React.createElement(LoaderComponent, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    let mainContent;
    if (globalUserProfileData) {
        // Prihlásený používateľ
        mainContent = React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement('h2', { className: 'text-3xl font-bold text-gray-800 mb-4' }, `Vitajte, ${globalUserProfileData.firstName}!`),
            React.createElement('p', { className: 'text-lg text-gray-600 mb-8' }, 'Vitajte na Slovak Open Handball 2025.'),
            React.createElement(
                'div',
                { className: 'mt-8' },
                React.createElement(
                    'a',
                    { href: 'logged-in-my-data.html', className: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Moja zóna'
                ),
                !categoriesExist && React.createElement('p', { className: 'text-lg text-red-500 font-semibold mt-4' }, 'Registračné dáta nie sú k dispozícii. Kontaktujte administrátora.'),
                categoriesExist && regStart && !isNaN(regStart) && now < regStart && (
                    React.createElement(
                        'div',
                        {className: 'mt-4'},
                        React.createElement('p', { className: 'text-xl text-red-600 font-semibold' }, 'Registrácia sa ešte nezačala.'),
                        React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia začne o: ${countdown}`)
                    )
                ),
                categoriesExist && regEnd && !isNaN(regEnd) && now > regEnd && (
                    React.createElement('p', { className: 'text-md text-gray-500 mt-2' }, `Registrácia skončila: ${new Date(registrationEndDate).toLocaleDateString('sk-SK')} o ${new Date(registrationEndDate).toLocaleTimeString('sk-SK')}`)
                ),
            )
        );
    } else {
        // Odhlásený používateľ
        mainContent = React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Slovak Open Handball 2025'),
            React.createElement('p', { className: 'text-xl text-gray-700' }, 'Pre pokračovanie sa, prosím, prihláste, alebo sa zaregistrujte.'),
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
                    'Registrácia na turnaj'
                )
            )
        );
    }


    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col' },
        React.createElement(
            'div',
            { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl flex-grow flex items-center justify-center' },
            mainContent
        )
    );
};

// Vykreslí aplikáciu až po načítaní DOM a skryje loader
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('root')) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App));
    }
});
