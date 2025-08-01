// index.js
// Tento súbor bol upravený tak, aby správne spravoval stav a predchádzal nekonečnému
// opakovaniu cyklov, ktoré môžu nastať pri nesprávnej interakcii Reactu a globálnych dát.
// Teraz načítava údaje o registrácii z Firestore databázy.

// Správne importy modulov priamo z CDN
import React, { useState, useEffect } from 'https://unpkg.com/react@18/index.js';
import ReactDOM from 'https://unpkg.com/react-dom@18/index.js';
import { Menu, User, LogIn, LogOut, Loader, X, ChevronDown, Check, UserPlus } from 'https://unpkg.com/lucide-react@latest/dist/esm/lucide-react.js';

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
            });
        }

        return () => clearInterval(timer);
    }, [registrationData]);

    let mainContent;

    if (loading) {
        mainContent = React.createElement(LoaderComponent, null);
    } else if (error) {
        mainContent = React.createElement(ErrorMessage, { message: error });
    } else if (registrationData) {
        const now = new Date();
        const regStart = new Date(registrationData.registrationStart);
        const regEnd = new Date(registrationData.registrationEnd);

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

// Vykreslí aplikáciu až po načítaní DOM a skryje loader
window.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('root')) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(App, null));
    }
});
