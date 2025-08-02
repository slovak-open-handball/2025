// logged-in-my-data.js
// Tento súbor bol upravený tak, aby sa spoliehal na externé skripty
// authentication.js a header.js pre správu autentifikácie a načítavanie dát.
// Kód bol vyčistený tak, aby zobrazoval iba meno, priezvisko a email prihláseného
// používateľa bez akejkoľvek ďalšej funkčnosti.

// Importy nie sú potrebné, keďže sa spoliehame na globálne premenné z iných skriptov.

const { useState, useEffect } = React;

/**
 * Pomocný komponent pre načítavanie dát.
 */
const Loader = () => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
        )
    );
};

/**
 * Pomocný komponent pre zobrazenie chybovej správy.
 * @param {object} props - Vlastnosti komponentu.
 * @param {string} props.message - Chybová správa na zobrazenie.
 */
const ErrorMessage = ({ message }) => {
    return React.createElement(
        'div',
        { className: 'flex justify-center pt-16' },
        React.createElement(
            'div',
            { className: 'p-8 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md' },
            React.createElement('p', { className: 'font-bold' }, 'Chyba'),
            React.createElement('p', null, message)
        )
    );
};

/**
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profil používateľa.
 * Tento komponent sa spolieha na globálne dáta (`window.globalUserProfileData`)
 * a na to, že `header.js` a `authentication.js` boli už načítané.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // useEffect pre načítanie globálnych dát
    useEffect(() => {
        const handleGlobalDataUpdate = () => {
            console.log('MyDataApp: Prijatá udalosť "globalDataUpdated".');
            if (window.globalUserProfileData) {
                setUserProfileData(window.globalUserProfileData);
                setLoading(false);
                setError(null);
            } else {
                setUserProfileData(null);
                setLoading(false);
                setError('Používateľské dáta neboli nájdené. Skúste sa prihlásiť.');
            }
        };

        // Pridáme listener pre vlastnú udalosť, ktorú posiela authentication.js
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);
        
        // Ak sú dáta už dostupné pri načítaní komponentu, nastavíme ich hneď
        if (window.globalUserProfileData) {
            handleGlobalDataUpdate();
        }

        // Zavoláme funkciu na načítanie hlavičky.
        // Hoci je vloženie hlavičky obsluhované v header.js,
        // ak je už DOM načítaný, musíme ju načítať explicitne.
        if (window.loadHeaderAndScripts) {
            window.loadHeaderAndScripts();
        }
        
        // Cleanup funkcia pre odhlásenie listenera
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Zobrazí loader, kým sa načítavajú dáta
    if (loading) {
        return React.createElement(Loader, null);
    }

    // Zobrazí chybu, ak sa dáta nenačítali
    if (error || !userProfileData) {
        return React.createElement(ErrorMessage, { message: error || 'Používateľské dáta neboli nájdené.' });
    }

    // Predpokladáme, že farba hlavičky pre všetkých bude modrá, keďže sa nejedná o admina.
    const headerColor = 'bg-blue-600';

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white p-8 rounded-xl shadow-lg mt-8` },
            React.createElement(
                'div',
                { className: `p-6 rounded-lg shadow-lg ${headerColor} mb-8` },
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-white' },
                    'Môj profil'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Meno:'),
                    ` ${userProfileData.firstName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'),
                    ` ${userProfileData.lastName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                    ` ${userProfileData.email}`
                )
            )
        )
    );
}

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("logged-in-my-data.js: Aplikácia vykreslená.");
} else {
    console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
