// index.js
// Tento súbor bol upravený tak, aby fungoval ako stránka s profilom prihláseného používateľa.
// Načítava globálne dáta používateľa z 'authentication.js' a zobrazuje ich.

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

// Jednoduchý Header komponent definovaný priamo tu.
const Header = () => {
    // Toto je zjednodušený zástupný header, pretože skutočný header je načítavaný cez header.js
    return null;
};

// Pomocné funkcie, ktoré sú potrebné pre renderovanie dát
const formatPhoneNumber = (number) => {
    return number ? number.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : '';
};

const formatAddress = (address) => {
    if (!address) return '';
    const { street, city, postalCode, country } = address;
    return `${street}, ${postalCode} ${city}, ${country}`;
};

// Funkcia na renderovanie detailov profilu používateľa
const renderProfileInfo = (userProfileData, headerColor) => {
    return React.createElement(
        'div',
        { className: 'bg-white rounded-lg shadow-md overflow-hidden' },
        React.createElement(
            'div',
            { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } },
            React.createElement(
                'h2',
                { className: 'text-2xl' },
                'Môj profil'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6' },
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg mb-2' },
                React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko:'),
                ` ${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim()
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg mb-2' },
                React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                ` ${userProfileData.email}`
            ),
            React.createElement(
                'p',
                { className: 'text-gray-800 text-lg' },
                React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo:'),
                ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
            ),
        )
    );
};

// Funkcia na renderovanie fakturačných a doručovacích údajov
const renderBillingAndAddressInfo = (userProfileData, headerColor) => {
    const isBillingAddressSame = userProfileData.isBillingAddressSameAsDelivery;
    const deliveryAddress = userProfileData.deliveryAddress;
    const billingAddress = isBillingAddressSame ? userProfileData.deliveryAddress : userProfileData.billingAddress;

    return React.createElement(
        'div',
        { className: 'grid md:grid-cols-2 gap-8 mt-8' },
        // Karta s doručovacími údajmi
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-md overflow-hidden' },
            React.createElement(
                'div',
                { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } },
                React.createElement('h2', { className: 'text-2xl' }, 'Doručovacie údaje')
            ),
            React.createElement(
                'div',
                { className: 'p-6' },
                deliveryAddress && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    formatAddress(deliveryAddress)
                ),
                !deliveryAddress && React.createElement(
                    'p',
                    { className: 'text-gray-500 italic' },
                    'Žiadne doručovacie údaje neboli zadané.'
                )
            )
        ),
        // Karta s fakturačnými údajmi
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-md overflow-hidden' },
            React.createElement(
                'div',
                { className: 'p-6 rounded-t-lg text-white font-bold', style: { backgroundColor: headerColor } },
                React.createElement(
                    'h2',
                    { className: 'text-2xl' },
                    'Fakturačné údaje',
                    isBillingAddressSame && React.createElement(
                        'span',
                        { className: 'text-sm font-normal ml-4 bg-blue-100 text-blue-800 px-2 py-1 rounded-full' },
                        'Rovnaké ako doručovacie'
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'p-6' },
                billingAddress && React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg' },
                    formatAddress(billingAddress)
                ),
                !billingAddress && !isBillingAddressSame && React.createElement(
                    'p',
                    { className: 'text-gray-500 italic' },
                    'Žiadne fakturačné údaje neboli zadané.'
                )
            )
        )
    );
};

// Hlavný komponent App
const App = () => {
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    // Načítanie globálnych dát pri inicializácii
    React.useEffect(() => {
        const handleGlobalDataUpdate = () => {
            console.log('index.js: Prijatá udalosť "globalDataUpdated". Aktualizujem dáta.');
            
            // Keď sa zmení stav autentifikácie (prihlásenie/odhlásenie)
            if (window.isGlobalAuthReady) {
                setLoading(false);
                const data = window.globalUserProfileData;
                setUserProfileData(data);
                if (!data) {
                    setError("Nie ste prihlásený, alebo dáta neboli nájdené.");
                } else {
                    setError(null);
                }
            } else {
                 // Ak ešte nie je autentifikácia pripravená, zobrazíme loader
                 setLoading(true);
            }
        };

        // Pridáme event listener pre globálnu udalosť
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Počiatočná kontrola stavu, ak už sú dáta dostupné
        if (window.isGlobalAuthReady) {
             handleGlobalDataUpdate();
        }

        // Clean-up funkcia pri odpojení komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Definovanie farby na základe stavu
    const headerColor = userProfileData ? '#3A8D41' : '#F56565';

    let mainContent;

    if (loading) {
        mainContent = React.createElement(LoaderComponent, null);
    } else if (error) {
        mainContent = React.createElement(ErrorMessage, { message: error });
    } else {
        mainContent = React.createElement(
            React.Fragment,
            null,
            React.createElement(renderProfileInfo, { userProfileData, headerColor }),
            React.createElement(renderBillingAndAddressInfo, { userProfileData, headerColor })
        );
    }

    return React.createElement(
        React.Fragment,
        null,
        React.createElement(Header, null), // Zástupný komponent
        React.createElement(
            'main',
            { className: 'container mx-auto p-8 mt-12 bg-white rounded-lg shadow-lg max-w-4xl flex-grow' },
            mainContent
        )
    );
};

// Export pre možnosť načítania v HTML
window.App = App;
