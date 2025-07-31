// logged-in-my-data.js
// Tento súbor definuje hlavný React komponent pre stránku "Moja zóna",
// ktorý načíta a zobrazuje profilové dáta prihláseného používateľa
// z Firestore databázy v reálnom čase.

// Dôležité: Tento súbor predpokladá, že firebase-app a authentication.js
// už boli načítané a inicializovali Firebase služby do globálneho objektu `window`.
const { useState, useEffect } = React;
const { getFirestore, doc, onSnapshot } = window.firebase.firestore;

// Hlavný React komponent pre stránku Moja zóna.
function MyDataApp() {
    // Stavové premenné pre uloženie dát profilu, stavu načítavania a chýb.
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Získanie globálnych inštancií Firebase a App ID.
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const auth = window.auth;
    const db = window.db;

    // useEffect hook na načítanie používateľských dát z Firestore.
    // Tento hook sa spustí, až keď je globálna autentifikácia pripravená a používateľ prihlásený.
    useEffect(() => {
        let unsubscribeUserDoc = () => {};

        // Vytvoríme funkciu na načítanie dát, ktorú zavoláme, keď je všetko pripravené.
        const fetchData = () => {
            if (auth && auth.currentUser) {
                console.log("MyDataApp: Používateľ prihlásený, načítavam dáta.");
                const userId = auth.currentUser.uid;
                const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, userId);

                unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        console.log("MyDataApp: Dáta profilu úspešne načítané:", userData);
                        setUserProfileData(userData);
                    } else {
                        console.warn("MyDataApp: Profil pre aktuálneho používateľa nebol nájdený.");
                        setUserProfileData(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("MyDataApp: Chyba pri načítaní dát profilu:", err);
                    setError('Chyba pri načítaní dát profilu. Skúste to prosím neskôr.');
                    setLoading(false);
                });
            } else {
                console.log("MyDataApp: Používateľ nie je prihlásený, čakám na zmenu stavu.");
                setLoading(false);
                setUserProfileData(null);
            }
        };

        // Zabezpečíme, že sa pokúsime načítať dáta, až keď je globálna autentifikácia pripravená.
        if (window.isGlobalAuthReady) {
            fetchData();
        } else {
            console.log("MyDataApp: Globálna autentifikácia ešte nie je pripravená, čakám...");
        }

        // Cleanup funkcia pre odhlásenie sa z onSnapshot listenera.
        return () => unsubscribeUserDoc();
    }, [window.isGlobalAuthReady, auth, db]); // Závislosti pre useEffect.

    // Zobrazenie stavu načítavania, chyby alebo dát.
    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-xl text-blue-600">Načítavam vaše údaje...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-red-500 text-center p-4">
                <p>{error}</p>
            </div>
        );
    }
    
    if (!userProfileData) {
        return (
            <div className="flex justify-center items-center h-full text-gray-500 text-center p-4">
                <p>Nenašli sa žiadne údaje vášho profilu. Skúste sa prihlásiť znova, alebo sa najprv zaregistrujte.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg p-8 m-4 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-2">Moje údaje</h2>
            
            <div className="mb-8">
                <h3 className="text-2xl font-semibold text-blue-600 mb-4">Osobné údaje</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-gray-800 text-lg"><span className="font-bold">Meno:</span> {userProfileData.personalInfo.name}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Priezvisko:</span> {userProfileData.personalInfo.surname}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">E-mail:</span> {userProfileData.email}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Telefón:</span> {userProfileData.personalInfo.phone}</p>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-2xl font-semibold text-blue-600 mb-4">Adresa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-gray-800 text-lg"><span className="font-bold">Ulica a číslo:</span> {userProfileData.address.street}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">PSČ:</span> {userProfileData.address.zip}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Mesto:</span> {userProfileData.address.city}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Krajina:</span> {userProfileData.address.country}</p>
                </div>
            </div>

            {userProfileData.billing && (
                <div>
                    <h3 className="text-2xl font-semibold text-blue-600 mb-4">Fakturačné údaje</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <p className="text-gray-800 text-lg"><span className="font-bold">Názov spoločnosti:</span> {userProfileData.billing.companyName}</p>
                        {userProfileData.billing.ico && <p className="text-gray-800 text-lg"><span className="font-bold">IČO:</span> {userProfileData.billing.ico}</p>}
                        {userProfileData.billing.dic && <p className="text-gray-800 text-lg"><span className="font-bold">DIČ:</span> {userProfileData.billing.dic}</p>}
                        {userProfileData.billing.icDph && <p className="text-gray-800 text-lg"><span className="font-bold">IČ DPH:</span> {userProfileData.billing.icDph}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

// Funkcia, ktorá sa postará o vykreslenie React aplikácie po tom,
// čo je `authentication.js` pripravený.
window.initMyDataApp = function() {
    console.log("logged-in-my-data.js: Inicializujem React aplikáciu.");
    try {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(MyDataApp));
        console.log("logged-in-my-data.js: React App úspešne vykreslená.");
    } catch (e) {
        console.error("logged-in-my-data.js: Chyba pri vykresľovaní MyDataApp:", e);
        document.getElementById('root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
    }
};

// Vytvoríme globálnu referenciu na komponent MyDataApp.
// To je potrebné pre správne vykreslenie v HTML súbore.
window.MyDataApp = MyDataApp;

// Dôležité: odstránime pôvodný window.onload listener z tohto súboru.
// Vykreslenie bude spúšťané priamo z authentication.js po prihlásení.
