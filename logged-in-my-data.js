// logged-in-my-data.js
// Tento súbor bol upravený tak, aby používal iba React.createElement() syntax.
// Spravuje načítanie a zobrazenie profilových a fakturačných dát používateľa
// z databázy Firestore.

// Definícia pomocných komponentov, ktoré sa používajú v App komponente
const Loader = () => {
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

// Funkcia na formátovanie telefónneho čísla
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return 'Nezadané';
    // Jednoduché formátovanie pre zobrazenie
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]}`;
    }
    return phoneNumber;
};

// Funkcia na určenie farby hlavičky na základe roly
const getHeaderColor = (role) => {
    switch (role) {
      case 'admin':
        return '#47b3ff'; // admin
      case 'hall':
        return '#b06835'; // hall
      case 'user':
        return '#9333EA'; // user
      default:
        return '#1D4ED8'; // default
    }
};

// Funkcia na vykreslenie fakturačných údajov a adresy
const renderBillingAndAddressInfo = (userProfileData) => {
    if (!userProfileData || (!userProfileData.billingInfo && !userProfileData.billingAddress)) {
        return null;
    }

    // Ak existujú fakturačné údaje
    const billingInfoContent = userProfileData.billingInfo ?
        React.createElement(React.Fragment, null,
            React.createElement(
                'h3',
                { className: 'text-xl font-bold mt-6 mb-2 text-gray-800' },
                'Fakturačné údaje'
            ),
            React.createElement(
                'div',
                { className: 'p-6 bg-gray-100 rounded-lg shadow-inner' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Názov spoločnosti:'),
                    ` ${userProfileData.billingInfo.companyName}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'IČO:'),
                    ` ${userProfileData.billingInfo.ico}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'DIČ:'),
                    ` ${userProfileData.billingInfo.dic}`
                ),
                userProfileData.billingInfo.icDPH && React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'IČ DPH:'),
                    ` ${userProfileData.billingInfo.icDPH}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Bankový účet:'),
                    ` ${userProfileData.billingInfo.bankAccount}`
                ),
            )
        ) : null;

    // Ak existujú údaje o fakturačnej adrese
    const billingAddressContent = userProfileData.billingAddress ?
        React.createElement(React.Fragment, null,
            React.createElement(
                'h3',
                { className: 'text-xl font-bold mt-6 mb-2 text-gray-800' },
                'Fakturačná adresa'
            ),
            React.createElement(
                'div',
                { className: 'p-6 bg-gray-100 rounded-lg shadow-inner' },
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Ulica a číslo:'),
                    ` ${userProfileData.billingAddress.street} ${userProfileData.billingAddress.streetNumber}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Mesto:'),
                    ` ${userProfileData.billingAddress.city}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'PSČ:'),
                    ` ${userProfileData.billingAddress.zipCode}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800' },
                    React.createElement('span', { className: 'font-bold' }, 'Krajina:'),
                    ` ${userProfileData.billingAddress.country}`
                )
            )
        ) : null;

    return React.createElement(React.Fragment, null, billingInfoContent, billingAddressContent);
};


// Main React component for the logged-in-my-data.html page
function MyDataApp() {
    // Lokálny stav pre používateľské dáta
    const [userProfileData, setUserProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    // Zabezpečíme, že appId je definované (používame globálnu premennú)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Effect pre načítanie údajov z Firestore
    React.useEffect(() => {
        const fetchUserProfileData = async () => {
            console.log("MyDataApp: Začínam načítavať používateľské dáta...");
            try {
                // Skontrolujeme, či sú globálne premenné definované
                if (typeof __firebase_config === 'undefined' || typeof __initial_auth_token === 'undefined') {
                    console.error("Firebase config alebo auth token nie sú definované.");
                    setError("Chyba pri inicializácii Firebase. Skontrolujte prosím konfiguráciu.");
                    setLoading(false);
                    return;
                }
                const firebaseConfig = JSON.parse(__firebase_config);
                const initialAuthToken = __initial_auth_token;
                
                // Inicializácia Firebase
                const app = firebase.initializeApp(firebaseConfig);
                const auth = firebase.auth(app);
                const db = firebase.firestore(app);

                // Prihlásenie s custom tokenom
                await auth.signInWithCustomToken(initialAuthToken);
                console.log("MyDataApp: Prihlásenie s custom tokenom úspešné.");

                const userId = auth.currentUser?.uid;
                if (!userId) {
                    setError("Používateľ nie je prihlásený.");
                    setLoading(false);
                    return;
                }
                
                // Načítanie profilových dát
                const userDocRef = db.collection('artifacts').doc(appId).collection('users').doc(userId);
                
                const unsubscribe = userDocRef.onSnapshot(docSnapshot => {
                    if (docSnapshot.exists) {
                        const data = docSnapshot.data();
                        console.log("MyDataApp: Dáta z Firestore načítané:", data);
                        setUserProfileData(data);
                    } else {
                        console.log("MyDataApp: Dokument s používateľským profilom neexistuje.");
                        setUserProfileData(null);
                    }
                    setLoading(false);
                }, err => {
                    console.error("MyDataApp: Chyba pri načítavaní dát z Firestore:", err);
                    setError("Nepodarilo sa načítať profilové dáta. Skúste to neskôr.");
                    setLoading(false);
                });

                return () => unsubscribe();

            } catch (err) {
                console.error("MyDataApp: Chyba v useEffect bloku:", err);
                setError("Nastala neočakávaná chyba.");
                setLoading(false);
            }
        };

        fetchUserProfileData();
    }, []);

    if (loading) {
        return React.createElement(Loader, null);
    }
    
    if (error) {
        return React.createElement(ErrorMessage, { message: error });
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'p-8 text-center text-gray-500' },
            'Neboli nájdené žiadne údaje o vašom profile.'
        );
    }

    const headerColor = getHeaderColor(userProfileData.role);

    return React.createElement(
        'div',
        { className: 'container mx-auto p-8 max-w-4xl' },
        React.createElement(
            'div',
            { className: 'bg-white rounded-lg shadow-lg' },
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
                userProfileData.role === 'admin' || userProfileData.role === 'hall' ? (
                    React.createElement(React.Fragment, null,
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Názov:'),
                            ` ${userProfileData.firstName}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa:'),
                            ` ${userProfileData.email}`
                        )
                    )
                ) : (
                    React.createElement(React.Fragment, null,
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Meno a priezvisko kontaktnej osoby:'),
                            ` ${userProfileData.firstName} ${userProfileData.lastName}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'E-mailová adresa kontaktnej osoby:'),
                            ` ${userProfileData.email}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg' },
                            React.createElement('span', { className: 'font-bold' }, 'Telefónne číslo kontaktnej osoby:'),
                            ` ${formatPhoneNumber(userProfileData.contactPhoneNumber)}`
                        )
                    )
                )
            ),
            renderBillingAndAddressInfo(userProfileData)
        )
    );
}

// Export pre možnosť načítania v HTML
window.MyDataApp = MyDataApp;
