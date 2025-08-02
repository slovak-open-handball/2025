// logged-in-my-data.js
// Tento súbor bol upravený, aby zobrazoval iba e-mailovú adresu prihláseného používateľa.
// Všetky ostatné údaje a funkcie boli odstránené, aby sa splnila požiadavka.

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
 * Hlavný React komponent MyDataApp, ktorý zobrazuje profilové dáta.
 */
function MyDataApp() {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [loading, setLoading] = useState(!window.isGlobalAuthReady);
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                setUserProfileData(data);
                setLoading(false);
                setError(null);
            } else {
                setUserProfileData(null);
                setLoading(false);
                setError('Profil používateľa nebol nájdený alebo nie ste prihlásený.');
            }
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        if (window.isGlobalAuthReady) {
            handleGlobalDataUpdate({ detail: window.globalUserProfileData });
        } else {
            setLoading(true);
        }

        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }

    if (error) {
        return React.createElement(ErrorMessage, { message: error });
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
                    React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                    ` ${userProfileData.email}`
                )
            )
        )
    );
}

// Explicitne sprístupniť komponent globálne
window.MyDataApp = MyDataApp;
