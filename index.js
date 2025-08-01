// index.js
// Tento súbor bol upravený tak, aby sa spoliehal na globálne premenné
// React, ReactDOM a LucideReact, ktoré sú načítané v index.html.
// To eliminuje potenciálne konflikty pri načítavaní modulov.

// Prístup ku globálnym premenným z window objektu
const { useState, useEffect } = window.React;
const { Menu, User, LogIn, LogOut, Loader, X, ChevronDown, Check, UserPlus } = window.LucideReact;

// Pomocné komponenty pre zobrazenie stavov načítania a chýb
const LoaderComponent = () => {
    return window.React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
        window.React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

const ErrorMessage = ({ message }) => {
    return window.React.createElement(
        'div',
        { className: 'flex justify-center items-center h-screen' },
        window.React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md max-w-md' },
            window.React.createElement('p', { className: 'font-bold' }, 'Chyba pri načítaní dát'),
            window.React.createElement('p', null, message)
        )
    );
};

// Zástupný Header komponent. Skutočný header je načítavaný cez header.js.
const Header = () => null;

const App = () => {
    const [registrationData, setRegistrationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const fetchRegistrationSettings = async () => {
            try {
                if (!window.db) {
                    console.error('Firestore databáza nie je inicializovaná.');
                    setError('Chyba: Firestore databáza nie je inicializovaná.');
                    setLoading(false);
                    return;
                }
                const docRef = window.doc(window.db, "settings", "registration");
                const unsubscribe = window.onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setRegistrationData(data);
                        setError(null);
                    } else {
                        console.log("Dokument nastavení registrácie neexistuje.");
                        setRegistrationData(null);
                        setError("Chyba: Nastavenia registrácie sa nenašli.");
                    }
                    setLoading(false);
                }, (e) => {
                    console.error("Chyba pri načítaní nastavení registrácie:", e);
                    setError("Chyba pri načítaní nastavení registrácie.");
                    setLoading(false);
                });

                return () => unsubscribe();
            } catch (e) {
                console.error("Všeobecná chyba pri načítavaní nastavení:", e);
                setError("Všeobecná chyba pri načítavaní nastavení.");
                setLoading(false);
            }
        };

        const timer = setInterval(() => {
            if (registrationData && registrationData.registrationStart) {
                const now = new Date();
                const regStart = new Date(registrationData.registrationStart);
                const diff = regStart - now;

                if (diff > 0) {
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setCountdown(`${days} dní, ${hours} hodín, ${minutes} minút, ${seconds} sekúnd`);
                } else {
                    setCountdown('');
                }
            }
        }, 1000);

        // Skontrolujeme, či je Firebase inicializovaný, a až potom načítame dáta.
        const checkFirebaseReady = () => {
            if (window.isGlobalAuthReady && window.db) {
                fetchRegistrationSettings();
                return true;
            }
            return false;
        };

        if (!checkFirebaseReady()) {
            window.addEventListener('globalDataUpdated', () => {
                checkFirebaseReady();
            }, { once: true });
        }

        return () => clearInterval(timer);
    }, [registrationData]);

    let mainContent;

    if (loading) {
        mainContent = window.React.createElement(LoaderComponent, null);
    } else if (error) {
        mainContent = window.React.createElement(ErrorMessage, { message: error });
    } else {
        const now = new Date();
        const regStart = registrationData ? new Date(registrationData.registrationStart) : null;
        const regEnd = registrationData ? new Date(registrationData.registrationEnd) : null;
        const registrationOpen = registrationData && regStart && regEnd && now >= regStart && now <= regEnd;

        let welcomeText = "Vitajte na stránke turnaja Slovak Open Handball.";
        let secondaryText = "Pre pokračovanie sa prosím prihláste.";
        if (registrationOpen) {
            secondaryText = "Pre pokračovanie sa prosím prihláste, alebo sa zaregistrujte.";
        } else if (regEnd && now > regEnd) {
            secondaryText = `Pre pokračovanie sa prosím prihláste. Registrácia na turnaj bola ukončená dňa: ${regEnd.toLocaleDateString('sk-SK')}.`;
        } else if (regStart && now < regStart) {
            secondaryText = `Pre pokračovanie sa prosím prihláste. Registrácia začne o: ${countdown}.`;
        } else if (registrationData && registrationData.isRegistrationOpen) {
            secondaryText = "Pre pokračovanie sa prosím prihláste, alebo sa zaregistrujte.";
        }

        mainContent = window.React.createElement(
            'div',
            { className: 'text-center p-8' },
            window.React.createElement('h1', { className: 'text-4xl font-bold mb-4 text-blue-800' }, 'Slovak Open Handball 2025'),
            window.React.createElement('p', { className: 'text-xl text-gray-700 mb-8' }, `${welcomeText} ${secondaryText}`),
            window.React.createElement('div', { className: 'flex justify-center space-x-4' },
                window.React.createElement(
                    'a',
                    {
                        href: 'login.html',
                        className: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200'
                    },
                    'Prihlásenie'
                ),
                registrationOpen && window.React.createElement(
                    'a',
                    {
                        href: 'logged-in-registration.html',
                        className: 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200'
                    },
                    'Registrácia na turnaj'
                )
            )
        );
    }

    return window.React.createElement(
        window.React.Fragment,
        null,
        window.React.createElement(Header, null),
        window.React.createElement(
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
    // Čakáme, kým bude Firebase inicializovaný cez authentication.js
    if (window.isGlobalAuthReady) {
        if (document.getElementById('root')) {
            const root = window.ReactDOM.createRoot(document.getElementById('root'));
            root.render(window.React.createElement(App, null));
        }
    } else {
        window.addEventListener('globalDataUpdated', () => {
            if (window.isGlobalAuthReady && document.getElementById('root')) {
                const root = window.ReactDOM.createRoot(document.getElementById('root'));
                root.render(window.React.createElement(App, null));
            }
        }, { once: true }); // Listener sa spustí len raz, potom sa odstráni
    }
});
