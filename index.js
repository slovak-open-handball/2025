// index.js
// Tento súbor bol prepracovaný, aby bol plne samostatný a robustný voči chybám
// v načítavaní a stave autentifikácie. Všetka logika je centralizovaná
// v jednom useEffect, ktorý sa spustí iba raz.

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
    const [countdown, setCountdown] = React.useState('');

    // Jediný useEffect na správu všetkých listenerov a dát
    React.useEffect(() => {
        let unsubscribeRegistrationData = () => {};
        let authReadyInterval = null;

        const setupListeners = () => {
            // Listener pre zmeny v autentifikácii
            const handleGlobalDataUpdate = (event) => {
                console.log("App: Prijatá udalosť 'globalDataUpdated', aktualizujem profil.");
                setGlobalUserProfileData(event.detail);
            };
            window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

            // Listener pre načítanie registračných dát z Firestore
            try {
                if (window.db) {
                    const docRef = doc(window.db, "artifacts", "soh2025-2s0o2h5");
                    unsubscribeRegistrationData = onSnapshot(docRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            console.log("App: Registračné dáta načítané.", data);
                            setRegistrationData(data);
                        } else {
                            console.warn("App: Registračné dáta neboli nájdené.");
                            setError("Registračné dáta nie sú k dispozícii. Kontaktujte administrátora.");
                        }
                        setLoading(false);
                    }, (err) => {
                        console.error("App: Chyba pri načítaní registračných dát:", err);
                        setError("Chyba pri načítaní registračných dát. Skúste to prosím neskôr.");
                        setLoading(false);
                    });
                } else {
                    console.error("App: Firestore nie je inicializovaný. Nastavenie listenera zlyhalo.");
                    setError("Firestore nie je inicializovaný. Skúste obnoviť stránku.");
                    setLoading(false);
                }
            } catch (err) {
                console.error("App: Chyba pri inicializácii listenera na dáta:", err);
                setError("Chyba pri inicializácii aplikácie. Skúste to prosím neskôr.");
                setLoading(false);
            }

            // Cleanup funkcia pre odhlásenie listenerov
            return () => {
                console.log("App: Odstraňujem listenery.");
                unsubscribeRegistrationData();
                window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
            };
        };

        // Skontrolujeme, či je autentifikácia už pripravená
        if (window.isGlobalAuthReady) {
            console.log("App: Firebase Auth je pripravený, spúšťam listenery.");
            return setupListeners();
        } else {
            // Ak nie je, počkáme na ňu, aby sme predišli pretekárskym podmienkam
            console.log("App: Čakám na inicializáciu Firebase Auth...");
            authReadyInterval = setInterval(() => {
                if (window.isGlobalAuthReady) {
                    console.log("App: Firebase Auth je pripravený, spúšťam listenery.");
                    clearInterval(authReadyInterval);
                    setupListeners();
                }
            }, 100);
        }

        // Cleanup intervalu, ak by sa komponent zrušil pred inicializáciou
        return () => {
            if (authReadyInterval) clearInterval(authReadyInterval);
        };
    }, []); // Prázdne pole závislostí zabezpečí, že sa tento efekt spustí iba raz


    // Samostatný useEffect pre odpočítavanie, závisí iba od registračných dát
    React.useEffect(() => {
        if (!registrationData || !registrationData.registrationStartDate) {
            setCountdown('');
            return;
        }

        const regStart = new Date(registrationData.registrationStartDate).getTime();
        const updateCountdown = () => {
            const now = new Date().getTime();
            const distance = regStart - now;

            if (distance > 0) {
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setCountdown('');
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [registrationData]);


    let mainContent;

    if (loading) {
        mainContent = React.createElement(LoaderComponent);
    } else if (error) {
        mainContent = React.createElement(ErrorMessage, { message: error });
    } else {
        const registrationActive = registrationData && registrationData.registrationEnabled;
        const categoriesExist = registrationData && registrationData.categories && registrationData.categories.length > 0;
        const userIsLoggedIn = globalUserProfileData !== null;
        
        if (userIsLoggedIn) {
            // Logika pre prihláseného používateľa
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h2', { className: 'text-3xl font-bold mb-4 text-green-600' }, 'Vitajte!'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, `Registrácia je teraz: ${registrationActive ? 'OTVORENÁ' : 'ZATVORENÁ'}`),
                registrationActive && categoriesExist && React.createElement(
                    'a',
                    { href: 'logged-in-registration.html', className: 'mt-8 inline-block bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-200' },
                    'Registrovať sa'
                ),
                !categoriesExist && React.createElement(
                    'p',
                    { className: 'text-md text-red-500 mt-2' },
                    'Registračné dáta nie sú k dispozícii. Kontaktujte administrátora.'
                )
            );
        } else {
            // Logika pre odhláseného používateľa
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
                        'Registrácia'
                    )
                )
            );
        }
    }

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

// Vykreslí aplikáciu až po načítaní DOM
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('root')) {
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    } else {
        console.error("Element s ID 'root' nebol nájdený. Aplikácia nemôže byť vykreslená.");
    }
});
