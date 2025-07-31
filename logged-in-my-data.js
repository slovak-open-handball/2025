// logged-in-my-data.js
// Tento súbor predpokladá, že Firebase SDK a React/ReactDOM sú inicializované v <head> logged-in-my-data.html
// a authentication.js spravuje globálnu autentifikáciu a stav používateľa.

// Main React component for the logged-in-my-data.html page
const MyDataApp = () => {
    // Získame referencie na Firebase služby a globálne dáta z authentication.js
    const auth = window.auth;
    const db = window.db;

    // Lokálny stav pre používateľské dáta, ktoré sa načítavajú po globálnej autentifikácii
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true); // Loading pre dáta v MyDataApp
    const [error, setError] = React.useState('');

    // Zabezpečíme, že appId je definované (používame globálnu premennú)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Effect pre načítanie používateľských dát z Firestore
    // Tento efekt sa spustí, až keď je globálna autentifikácia pripravená.
    React.useEffect(() => {
        let unsubscribeUserDoc;

        // Čakáme, kým bude globálna autentifikácia pripravená a používateľ prihlásený
        if (window.isGlobalAuthReady && db && auth && auth.currentUser) {
            console.log(`MyDataApp: Globálna autentifikácia pripravená. Pokúšam sa načítať profil pre používateľa: ${auth.currentUser.uid}`);
            setLoading(true);

            const userDocRef = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid);

            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("MyDataApp: Dáta profilu úspešne načítané.");
                    setUserProfileData({ id: docSnap.id, ...data });
                } else {
                    console.log("MyDataApp: Žiadne dáta profilu neexistujú.");
                    setUserProfileData(null);
                }
                setLoading(false);
            }, (error) => {
                console.error("MyDataApp: Chyba pri načítaní dát profilu:", error);
                setError('Chyba pri načítaní dát profilu. Skúste to prosím neskôr.');
                setLoading(false);
            });
        } else if (window.isGlobalAuthReady) {
            // Ak je auth pripravené, ale používateľ nie je prihlásený
            setLoading(false);
            setUserProfileData(null);
        }

        // Cleanup funkcia pre odhlásenie
        return () => {
            if (unsubscribeUserDoc) {
                unsubscribeUserDoc();
            }
        };
    }, [window.isGlobalAuthReady, db, auth]);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'text-center p-8' },
            React.createElement('h2', { className: 'text-xl font-semibold' }, 'Načítavam vaše dáta...')
        );
    }

    if (error) {
        return React.createElement(
            'div',
            { className: 'text-center p-8 text-red-600' },
            React.createElement('h2', { className: 'text-xl font-semibold' }, 'Chyba:'),
            React.createElement('p', null, error)
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'text-center p-8' },
            React.createElement('h2', { className: 'text-xl font-semibold' }, 'Dáta neboli nájdené'),
            React.createElement('p', null, 'Zdá sa, že váš profil ešte nebol vytvorený.')
        );
    }

    return React.createElement(
        'div',
        { className: "bg-white rounded-xl shadow-lg p-8 mx-auto" },
        React.createElement(
            'h1',
            { className: "text-3xl font-bold text-center text-blue-800 mb-6" },
            'Moje Údaje'
        ),
        React.createElement(
            'div',
            { className: "grid grid-cols-1 md:grid-cols-2 gap-8" },
            // Osobné údaje
            React.createElement(
                'div',
                { className: "bg-blue-50 p-6 rounded-lg shadow-inner" },
                React.createElement(
                    'h2',
                    { className: "text-2xl font-bold text-blue-700 mb-4" },
                    'Osobné údaje'
                ),
                React.createElement('div', { className: 'space-y-2' },
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Meno:'), ` ${userProfileData.firstName}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Priezvisko:'), ` ${userProfileData.lastName}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Email:'), ` ${userProfileData.email}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Telefón:'), ` ${userProfileData.phone}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Rola:'), ` ${userProfileData.role}`))
                )
            ),
            // Fakturačné údaje
            userProfileData.billing && React.createElement(
                'div',
                { className: "bg-green-50 p-6 rounded-lg shadow-inner" },
                React.createElement(
                    'h2',
                    { className: "text-2xl font-bold text-green-700 mb-4" },
                    'Fakturačné údaje'
                ),
                React.createElement('div', { className: 'space-y-2' },
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Názov firmy:'), ` ${userProfileData.billing.company}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'), ` ${userProfileData.billing.street}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'Mesto:'), ` ${userProfileData.billing.city}`)),
                    React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'PSČ:'), ` ${userProfileData.billing.zip}`)),
                    userProfileData.billing.ico && React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'IČO:'), ` ${userProfileData.billing.ico}`)),
                    userProfileData.billing.dic && React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'DIČ:'), ` ${userProfileData.billing.dic}`)),
                    userProfileData.billing.icDph && React.createElement('div', null, React.createElement('p', { className: 'text-gray-800 text-lg whitespace-nowrap' }, React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'), ` ${userProfileData.billing.icDph}`))
                )
            )
        )
    );
};

// Vykreslíme React aplikáciu až keď je skript plne načítaný
// Tým sa vyhneme chybám s chýbajúcim komponentom MyDataApp
document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined' || typeof MyDataApp === 'undefined') {
            console.error("Chyba: React, ReactDOM alebo MyDataApp komponent nie sú načítané. Skontrolujte poradie a typ skriptov.");
            rootElement.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
            return;
        }

        // Vykreslíme React komponent
        ReactDOM.render(
            React.createElement(MyDataApp),
            rootElement
        );
        console.log("logged-in-my-data.js: React App vykreslená po načítaní DOM.");
    }
});
