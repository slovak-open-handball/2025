// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.
// Teraz načítava údaje o registrácii z Firestore databázy.

const { Menu, User, LogIn, LogOut, Loader, X, ChevronDown, Check, UserPlus } = LucideReact;

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

    React.useEffect(() => {
        const unsubscribe = () => {};

        // Skontrolujeme, či sú globálne premenné dostupné
        if (!window.db) {
            setError("Chyba: Firebase databáza nie je inicializovaná.");
            setLoading(false);
            return;
        }

        const registrationDocRef = window.db.doc('/settings/registration');
        const onSnapshotCallback = (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRegistrationData(data);
                setLoading(false);
                console.log("index.js: Dáta o registrácii načítané:", data);
            } else {
                setError("Chyba: Dokument o registrácii nebol nájdený.");
                setLoading(false);
            }
        };

        try {
            unsubscribe = onSnapshot(registrationDocRef, onSnapshotCallback, (err) => {
                console.error("index.js: Chyba pri načítaní dokumentu o registrácii:", err);
                setError("Chyba pri načítaní dát o registrácii.");
                setLoading(false);
            });
        } catch (err) {
            console.error("index.js: Chyba pri nastavení listenera:", err);
            setError("Chyba pri nastavení listenera pre dáta o registrácii.");
            setLoading(false);
        }

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);


    let mainContent;

    if (loading) {
        mainContent = React.createElement(LoaderComponent, null);
    } else if (error) {
        mainContent = React.createElement(ErrorMessage, { message: error });
    } else {
        const now = new Date();
        const regStart = new Date(registrationData.registrationStart);
        const regEnd = new Date(registrationData.registrationEnd);
        const countdown = new Date(regStart - now).toISOString().substr(11, 8); // Zjednodušený odpočet

        if (now < regStart) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Registrácia sa ešte nezačala.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, `Registrácia začne o: ${countdown}`)
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
