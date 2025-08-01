// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.
// Teraz načítava údaje o registrácii z Firestore databázy a reaguje na globálne zmeny v stave autentifikácie.

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

// Zástupný Header komponent. Skutočný header je načítavaný cez header.js.
// Vďaka globálnemu listeneru, ktorý sa volá v index.html, sa obsah hlavičky aktualizuje
// automaticky a tento komponent slúži len ako placeholder.
const Header = () => null;

// Hlavný komponent aplikácie
const App = () => {
    const [registrationData, setRegistrationData] = React.useState(null);
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [countdown, setCountdown] = React.useState('');

    // Efekt pre načítanie dát o registrácii z Firestore
    React.useEffect(() => {
        // Kontrolujeme, či je databáza inicializovaná.
        if (!window.db) {
            console.error("Firebase Firestore nie je inicializovaný. Skontrolujte authentication.js.");
            setError("Chyba pri inicializácii databázy.");
            setLoading(false);
            return;
        }

        const db = window.db;
        const registrationDocRef = doc(db, 'artifacts', 'config', 'public', 'data', 'registration');

        const unsubscribe = onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRegistrationData(data);
                console.log("index.js: Načítané údaje o registrácii:", data);
            } else {
                console.log("index.js: Dokument s registračnými dátami neexistuje. Pravdepodobne ešte nebol vytvorený.");
                setRegistrationData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("index.js: Chyba pri načítaní registračných dát:", err);
            setError("Chyba pri načítaní dát registrácie z databázy.");
            setLoading(false);
        });

        // Cleanup funkcia pre odhlásenie sa z listenera
        return () => unsubscribe();
    }, []);

    // Efekt pre aktualizáciu profilových dát používateľa
    React.useEffect(() => {
        // Funkcia na aktualizáciu stavu z globálnej premennej
        const updateUserData = () => {
            const newUserData = window.globalUserProfileData;
            setUserProfileData(newUserData);
            console.log("index.js: Aktualizácia profilu používateľa.", newUserData);
        };

        // Pridanie listenera pre globálnu udalosť
        window.addEventListener('globalDataUpdated', updateUserData);
        
        // Okamžité nastavenie po načítaní
        updateUserData();

        // Cleanup listenera pri odmountovaní komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', updateUserData);
        };
    }, []);

    // Efekt pre odpočet času do začiatku registrácie
    React.useEffect(() => {
        let timer = null;
        if (registrationData && registrationData.registrationStart) {
            const calculateCountdown = () => {
                const now = new Date();
                const regStart = new Date(registrationData.registrationStart.seconds * 1000);
                const diff = regStart - now;

                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
                } else {
                    setCountdown('');
                }
            };
            timer = setInterval(calculateCountdown, 1000);
        }

        // Cleanup funkcia pre zastavenie časovača
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [registrationData]); // Znova spustíme časovač, ak sa zmenia dáta

    // Podmienené renderovanie
    if (loading) {
        return React.createElement(LoaderComponent, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }
    
    let mainContent;
    const now = new Date();
    const regStart = registrationData ? new Date(registrationData.registrationStart.seconds * 1000) : null;
    const regEnd = registrationData ? new Date(registrationData.registrationEnd.seconds * 1000) : null;

    if (!regStart || !regEnd) {
        mainContent = React.createElement(
            'div',
            { className: 'text-center' },
            React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-gray-800' }, 'Stav registrácie nie je definovaný.'),
            React.createElement('p', { className: 'text-xl text-gray-700' }, 'Prosím, skontrolujte neskôr.')
        );
    } else {
        if (now < regStart) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia sa ešte nezačala.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, `Registrácia začne o: ${countdown}`)
            );
        } else if (now >= regStart && now <= regEnd) {
            if (userProfileData) {
                // Používateľ je prihlásený a registrácia je otvorená
                mainContent = React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-green-600' }, 'Registrácia je otvorená!'),
                    React.createElement('p', { className: 'text-xl text-gray-700' }, `Vitajte, ${userProfileData.firstName}! Môžete sa zaregistrovať na turnaj.`)
                );
            } else {
                // Používateľ nie je prihlásený, ale registrácia je otvorená
                mainContent = React.createElement(
                    'div',
                    { className: 'text-center' },
                    React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-green-600' }, 'Registrácia je otvorená!'),
                    React.createElement('p', { className: 'text-xl text-gray-700' }, 'Pre registráciu sa prosím prihláste.')
                );
            }
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
    }
});
