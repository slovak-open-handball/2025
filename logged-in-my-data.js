// logged-in-my-data.js
// Tento súbor definuje hlavný React komponent pre stránku "Moja zóna",
// ktorý načíta a zobrazuje profilové dáta prihláseného používateľa
// z Firestore databázy v reálnom čase.

// Používame globálne premenné 'React' a 'ReactDOM' z unpkg.com,
// a taktiež globálne Firebase inštancie z 'authentication.js'.
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
    // Tento hook sa spustí len raz, pri prvom načítaní komponentu.
    useEffect(() => {
        let unsubscribeUserDoc = () => {};

        // Skontrolujeme, či sú globálne Firebase inštancie a používateľ prihlásený.
        // Až keď je všetko pripravené, môžeme začať s načítavaním dát.
        if (window.isGlobalAuthReady && auth && db && auth.currentUser) {
            console.log("MyDataApp: Globálna autentifikácia je pripravená. Načítavam dáta používateľa...");
            
            const userId = auth.currentUser.uid;
            // Cesta k dokumentu používateľa vo Firestore.
            const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, userId);

            // Nastavíme listener na zmeny v dokumente používateľa.
            // onSnapshot zabezpečí, že ak sa dáta zmenia, UI sa automaticky aktualizuje.
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    // Ak dokument existuje, uložíme dáta do stavu.
                    const userData = docSnap.data();
                    console.log("MyDataApp: Dáta profilu úspešne načítané:", userData);
                    setUserProfileData(userData);
                } else {
                    // Ak dokument neexistuje, nastavíme stav na null.
                    console.warn("MyDataApp: Profil pre aktuálneho používateľa nebol nájdený.");
                    setUserProfileData(null);
                }
                setLoading(false); // Načítavanie je ukončené.
            }, (err) => {
                // Spracovanie chyby pri načítavaní dát.
                console.error("MyDataApp: Chyba pri načítaní dát profilu:", err);
                setError('Chyba pri načítaní dát profilu. Skúste to prosím neskôr.');
                setLoading(false); // Načítavanie je ukončené.
            });

        } else if (!window.isGlobalAuthReady) {
            console.log("MyDataApp: Čakám na inicializáciu globálnej autentifikácie...");
        } else {
            console.log("MyDataApp: Používateľ nie je prihlásený, nie je možné načítať dáta.");
            setLoading(false);
            setUserProfileData(null);
        }

        // Cleanup funkcia pre odhlásenie sa z onSnapshot listenera.
        // Toto zabráni úniku pamäte.
        return () => unsubscribeUserDoc();
    }, [window.isGlobalAuthReady, auth, db]); // Závislosti pre useEffect.

    // Zobrazenie stavu načítavania.
    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <p className="text-xl text-blue-600">Načítavam vaše údaje...</p>
            </div>
        );
    }

    // Zobrazenie chyby, ak nastala.
    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-red-500 text-center p-4">
                <p>{error}</p>
            </div>
        );
    }
    
    // Zobrazenie správy, ak nie sú dostupné žiadne údaje.
    if (!userProfileData) {
        return (
            <div className="flex justify-center items-center h-full text-gray-500 text-center p-4">
                <p>Nenašli sa žiadne údaje vášho profilu. Skúste sa prihlásiť znova, alebo sa najprv zaregistrujte.</p>
            </div>
        );
    }
    
    // Hlavné vykreslenie používateľských dát.
    return (
        <div className="bg-white rounded-xl shadow-lg p-8 m-4 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-blue-800 mb-6 border-b-2 border-blue-200 pb-2">Moje údaje</h2>
            
            {/* Sekcia Osobné údaje */}
            <div className="mb-8">
                <h3 className="text-2xl font-semibold text-blue-600 mb-4">Osobné údaje</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-gray-800 text-lg"><span className="font-bold">Meno:</span> {userProfileData.personalInfo.name}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Priezvisko:</span> {userProfileData.personalInfo.surname}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">E-mail:</span> {userProfileData.email}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Telefón:</span> {userProfileData.personalInfo.phone}</p>
                </div>
            </div>

            {/* Sekcia Adresa */}
            <div className="mb-8">
                <h3 className="text-2xl font-semibold text-blue-600 mb-4">Adresa</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-gray-800 text-lg"><span className="font-bold">Ulica a číslo:</span> {userProfileData.address.street}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">PSČ:</span> {userProfileData.address.zip}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Mesto:</span> {userProfileData.address.city}</p>
                    <p className="text-gray-800 text-lg"><span className="font-bold">Krajina:</span> {userProfileData.address.country}</p>
                </div>
            </div>

            {/* Sekcia Fakturačné údaje (ak existujú) */}
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

// Po načítaní DOM a všetkých skriptov vykreslíme React aplikáciu.
// Táto logika je kľúčová, aby sa komponent nezačal vykresľovať
// skôr, než sú dostupné všetky závislosti.
window.onload = function() {
    console.log("logged-in-my-data.js: DOM a skripty načítané, spúšťam vykresľovanie React aplikácie.");
    // Počkáme, kým sa načíta hlavička, a potom vykreslíme aplikáciu.
    // Týmto zabezpečíme správne poradie načítania a zobrazenia.
    loadHeader().then(() => {
        try {
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(React.createElement(MyDataApp));
            console.log("logged-in-my-data.js: React App úspešne vykreslená.");
        } catch (e) {
            console.error("logged-in-my-data.js: Chyba pri vykresľovaní MyDataApp:", e);
            document.getElementById('root').innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Chyba pri načítaní aplikácie. Skúste to prosím neskôr.</div>';
        }
    }).catch(error => {
        console.error("Chyba pri načítaní hlavičky:", error);
    });
};

// Vytvoríme globálnu referenciu na komponent MyDataApp.
// To je potrebné pre správne vykreslenie v HTML súbore.
window.MyDataApp = MyDataApp;
