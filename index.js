// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.
// Teraz načítava údaje o registrácii z Firestore databázy.
// Chybné volanie LucideReact bolo odstránené.

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
    // Globálne dáta o stave autentifikácie
    const isAuthReady = window.isGlobalAuthReady;
    const globalUserProfileData = window.globalUserProfileData;

    // Lokálny stav komponentu pre dáta o registrácii a čas odpočítavania
    const [registrationData, setRegistrationData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [countdown, setCountdown] = React.useState('');

    // Efekt na načítanie dát o registrácii z Firestore
    React.useEffect(() => {
        // Získanie inštancie databázy
        const db = window.db;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = window.doc(db, `artifacts/${appId}/public/data/registration`);

        // onSnapshot listener pre sledovanie zmien v reálnom čase
        const unsubscribe = window.onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                console.log("index.js: Dáta o registrácii boli úspešne načítané.");
                setRegistrationData(docSnap.data());
            } else {
                console.warn("index.js: Dokument s dátami o registrácii neexistuje.");
                setError("Dáta o registrácii neboli nájdené.");
            }
            setLoading(false);
        }, (err) => {
            console.error("index.js: Chyba pri načítaní dát o registrácii: ", err);
            setError("Chyba pri načítaní dát o registrácii.");
            setLoading(false);
        });

        // Cleanup funkcia pre odhlásenie odberu onSnapshot pri odmountovaní komponentu
        return () => unsubscribe();
    }, []);

    // Efekt pre odpočítavanie do začiatku registrácie
    React.useEffect(() => {
        if (!registrationData) return;

        const interval = setInterval(() => {
            const now = new Date();
            const regStart = new Date(registrationData.registrationStart.seconds * 1000);

            if (now < regStart) {
                const diff = regStart - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${days} dní, ${hours} hodín, ${minutes} minút a ${seconds} sekúnd`);
            } else {
                setCountdown('');
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [registrationData]);

    // Zobrazenie načítavacieho stavu
    if (loading) {
        return React.createElement(LoaderComponent, null);
    }

    // Zobrazenie chybového stavu
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    let mainContent = null;
    const now = new Date();

    if (registrationData) {
        const regStart = new Date(registrationData.registrationStart.seconds * 1000);
        const regEnd = new Date(registrationData.registrationEnd.seconds * 1000);
        const categoriesExist = registrationData.categories && registrationData.categories.length > 0;
        const isRegistrationOpen = now >= regStart && now <= regEnd;

        if (isRegistrationOpen && categoriesExist) {
            mainContent = React.createElement(
                'div',
                { className: 'text-center' },
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-green-600' }, 'Registrácia je otvorená!'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, 'Môžete sa zaregistrovať na turnaj.')
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
                React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-red-600' }, 'Registrácia skončila.'),
                React.createElement('p', { className: 'text-xl text-gray-700' }, 'Registračný proces pre tento rok bol už ukončený.')
            );
        }
    } else {
         mainContent = React.createElement(
            ErrorMessage,
            { message: "Chyba: Dáta o registrácii neboli nájdené." }
        );
    }


    return React.createElement(
        'div',
        { className: 'bg-gray-100 min-h-screen flex flex-col' },
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
