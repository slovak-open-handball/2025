// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.
// Teraz načítava údaje o registrácii z Firestore databázy.

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

// Zástupný Header komponent. Skutočný header je načítavaný cez header.js.
const Header = () => null;

const App = () => {
    const [registrationData, setRegistrationData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [countdown, setCountdown] = React.useState('');

    // Pre správne fungovanie pri zmene času, ak je užívateľ na stránke
    React.useEffect(() => {
        const timer = setInterval(() => {
            if (registrationData && Date.now() < registrationData.registrationStart.toMillis()) {
                const now = new Date();
                const diff = registrationData.registrationStart.toMillis() - now.getTime();
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setCountdown(null);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [registrationData]);

    // Načítanie registračných dát z Firestore
    React.useEffect(() => {
        const fetchData = () => {
            // Skontrolujeme, či sú Firebase a Firestore funkcie dostupné
            if (!window.db || !window.onSnapshot || !window.doc) {
                console.error("Firebase služby nie sú dostupné.");
                setLoading(false);
                setError("Chyba: Firebase knižnice sa nepodarilo načítať.");
                return;
            }

            try {
                // Použijeme globálne dostupné funkcie a appId
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const regDocRef = window.doc(window.db, `artifacts/${appId}/public/settings/registrationSettings`);
                
                const unsubscribe = window.onSnapshot(regDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        console.log("Dáta o registrácii načítané:", docSnap.data());
                        setRegistrationData(docSnap.data());
                    } else {
                        console.log("Dokument s registračnými nastaveniami nebol nájdený.");
                        setRegistrationData({ registrationStart: null, registrationEnd: null });
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Chyba pri načítaní registračných nastavení:", err);
                    setError("Chyba pri načítaní nastavení. Skúste to prosím neskôr.");
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (err) {
                console.error("Všeobecná chyba pri načítavaní nastavení:", err);
                setError("Vyskytla sa neočakávaná chyba.");
                setLoading(false);
            }
        };

        // Spustíme načítanie dát až po tom, čo je pripravená autentifikácia
        // a máme prístup k window.db.
        // Listener `globalDataUpdated` z `authentication.js` sa o to postará.
        const handleGlobalDataUpdate = () => {
            if (window.db && window.isGlobalAuthReady) {
                fetchData();
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Počiatočné volanie pre prípad, že event už prebehol pred pripojením listenera
        if (window.db && window.isGlobalAuthReady) {
            fetchData();
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);


    if (loading) {
        return React.createElement(LoaderComponent);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    let mainContent;
    const now = Date.now();
    
    // Ak registrácia nie je definovaná (dokument neexistuje)
    if (!registrationData || !registrationData.registrationStart || !registrationData.registrationEnd) {
        mainContent = React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-gray-800' }, 'Informácie o registrácii nie sú k dispozícii.'),
            React.createElement('p', { className: 'text-xl text-gray-700' }, 'Prosím, skontrolujte stránku neskôr.')
        );
    } else {
        const regStart = registrationData.registrationStart.toMillis();
        const regEnd = registrationData.registrationEnd.toMillis();

        if (now < regStart) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia sa ešte nezačala.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, countdown ? `Registrácia začne o: ${countdown}` : 'Čakáme na začiatok registrácie.')
            );
        } else if (now >= regStart && now <= regEnd) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-green-600' }, 'Registrácia je otvorená!'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, 'Môžete sa zaregistrovať na turnaj.')
            );
        } else { // now > regEnd
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-red-600' }, 'Registrácia skončila.'),
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
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
        console.log("index.js: React App vykreslená.");
    }
});
