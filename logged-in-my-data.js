// logged-in-my-data.js
// Tento súbor obsahuje React komponent LoggedInApp, ktorý zobrazuje informácie o prihlásenom používateľovi
// a pre administrátorov aj zoznam všetkých používateľov.

// Importy Firebase SDKs (predpokladá sa, že sú načítané globálne v HTML)
// const firebase = window.firebase; // Ak by nebolo globálne dostupné

const LoggedInApp = () => {
    // Stavy pre správu dát a UI
    const [user, setUser] = React.useState(null); // Aktuálne prihlásený používateľ
    const [loadingAuth, setLoadingAuth] = React.useState(true); // Načítavanie stavu autentifikácie
    const [isAdmin, setIsAdmin] = React.useState(false); // Určuje, či je používateľ administrátor
    const [usersList, setUsersList] = React.useState([]); // Zoznam všetkých používateľov (len pre adminov)
    const [loadingUsers, setLoadingUsers] = React.useState(false); // Načítavanie zoznamu používateľov
    const [usersFetchError, setUsersFetchError] = React.useState(null); // Chyba pri načítaní používateľov

    // Referencie na Firebase inštancie
    const app = React.useRef(null);
    const auth = React.useRef(null);
    const db = React.useRef(null);

    // Efekt pre inicializáciu Firebase a nastavenie poslucháča autentifikácie
    React.useEffect(() => {
        // Získanie globálnych premenných
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

        try {
            // Inicializácia Firebase aplikácie, ak už nie je inicializovaná
            // Použije predvolenú aplikáciu, ktorá je inicializovaná v logged-in-my-data.html
            if (!firebase.apps.length) {
                app.current = firebase.initializeApp(firebaseConfig);
            } else {
                app.current = firebase.app(); // Použije existujúcu predvolenú aplikáciu
            }
            auth.current = firebase.auth(app.current);
            db.current = firebase.firestore(app.current);

            // Prihlásenie anonymne alebo s vlastným tokenom (ak je k dispozícii)
            const signIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await auth.current.signInWithCustomToken(__initial_auth_token);
                        console.log("Prihlásenie s vlastným tokenom pre logged-in-my-data.js");
                    } else {
                        await auth.current.signInAnonymously();
                        console.log("Prihlásenie anonymne pre logged-in-my-data.js");
                    }
                } catch (error) {
                    console.error("Chyba pri prihlásení v logged-in-my-data.js:", error);
                    // Tu by ste mohli presmerovať na prihlasovaciu stránku alebo zobraziť modálne okno
                }
            };
            signIn();

        } catch (error) {
            console.error("Chyba pri inicializácii Firebase v logged-in-my-data.js:", error);
            setLoadingAuth(false);
            return;
        }

        // Poslucháč zmien stavu autentifikácie
        const unsubscribeAuth = auth.current.onAuthStateChanged(async (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);

            if (currentUser) {
                // Načítanie vlastnej roly používateľa z Firestore
                // Predpokladá sa, že rola je uložená v profile používateľa
                const userProfileRef = db.current.collection("artifacts").doc(appId).collection("users").doc(currentUser.uid).collection("profile").doc("data");
                try {
                    const docSnap = await userProfileRef.get();
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        setIsAdmin(userData.role === 'admin');
                        console.log(`Používateľ ${currentUser.uid} má rolu: ${userData.role || 'user'}`);
                    } else {
                        setIsAdmin(false); // Predvolená rola na 'user', ak profil neexistuje
                        console.log(`Profil používateľa ${currentUser.uid} neexistuje. Predvolená rola: user.`);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní profilu používateľa:", error);
                    setIsAdmin(false); // Predpokladá sa 'user' rola pri chybe
                }
            } else {
                setIsAdmin(false); // Ak nie je používateľ prihlásený, nie je admin
            }
        });

        // Cleanup funkcia pre odhlásenie poslucháča
        return () => unsubscribeAuth();
    }, []); // Prázdne pole závislostí zabezpečuje spustenie len raz pri mountovaní

    // Efekt pre načítanie zoznamu všetkých používateľov (spustí sa len pre adminov)
    React.useEffect(() => {
        // Skontroluje, či sú Firebase inštancie a používateľ k dispozícii
        if (!db.current || !auth.current || !auth.current.currentUser || !user) {
            return; // Čaká, kým sa autentifikácia a DB inicializujú
        }

        // AK JE POUŽÍVATEĽ ADMINISTRÁTOR, pokúsi sa načítať zoznam všetkých používateľov
        if (isAdmin) {
            setLoadingUsers(true);
            setUsersFetchError(null); // Vymaže predchádzajúce chyby

            // Referencia na kolekciu všetkých používateľov
            const usersCollectionRef = db.current.collection("artifacts").doc(__app_id).collection("users");

            // Nastavenie poslucháča pre zmeny v kolekcii používateľov
            const unsubscribeUsers = usersCollectionRef.onSnapshot((snapshot) => {
                const fetchedUsers = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setUsersList(fetchedUsers);
                setLoadingUsers(false);
                console.log("Používatelia načítaní (admin).");
            }, (error) => {
                console.error("LoggedInApp: Chyba pri načítaní používateľov z Firestore:", error);
                // Kontrola, či ide o chybu oprávnení a zobrazenie používateľsky prívetivej správy
                if (error.code === 'permission-denied') {
                    setUsersFetchError("Nemáte oprávnenie na zobrazenie zoznamu používateľov.");
                } else {
                    setUsersFetchError("Chyba pri načítaní používateľov. Skúste to prosím neskôr.");
                }
                setLoadingUsers(false);
            });

            // Cleanup funkcia pre odhlásenie poslucháča
            return () => unsubscribeUsers();
        } else {
            // AK NIE JE POUŽÍVATEĽ ADMINISTRÁTOR, nenačíta zoznam používateľov
            setUsersList([]); // Zabezpečí, že zoznam je prázdny
            setLoadingUsers(false); // Zastaví načítavanie
            setUsersFetchError(null); // Vymaže akúkoľvek predchádzajúcu chybu
            console.log("Používateľ nie je administrátor, zoznam používateľov sa nenačíta.");
        }
    }, [isAdmin, user]); // Spustí sa, keď sa zmení isAdmin alebo user

    // Zobrazenie načítavacieho stavu autentifikácie
    if (loadingAuth) {
        return <div className="flex justify-center items-center h-screen"><p>Načítavam autentifikáciu...</p></div>;
    }

    // Zobrazenie správy, ak používateľ nie je prihlásený
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h2 className="text-2xl font-bold mb-4">Nie ste prihlásený</h2>
                    <p className="text-gray-700 mb-6">Pre prístup k Mojej Zóne sa musíte prihlásiť.</p>
                    <a href="login.html" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300">
                        Prejsť na prihlásenie
                    </a>
                </div>
            </div>
        );
    }

    // Hlavné zobrazenie pre prihláseného používateľa
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8 px-4">
            <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Moja Zóna</h1>

                {/* Sekcia informácií o používateľovi */}
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Informácie o používateľovi</h2>
                    <p className="text-gray-600">
                        <span className="font-medium">UID:</span> {user.uid}
                    </p>
                    <p className="text-gray-600">
                        <span className="font-medium">Email:</span> {user.email || 'N/A'}
                    </p>
                    <p className="text-gray-600">
                        <span className="font-medium">Rola:</span> {isAdmin ? 'Administrátor' : 'Používateľ'}
                    </p>
                </div>

                {/* Podmienené zobrazenie sekcie pre správu používateľov (len pre adminov) */}
                {isAdmin ? (
                    <div className="mt-8 pt-8 border-t border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Správa používateľov (Admin)</h2>
                        {loadingUsers ? (
                            <p>Načítavam používateľov...</p>
                        ) : usersFetchError ? (
                            // Zobrazenie používateľsky prívetivej chyby
                            <p className="text-red-500">{usersFetchError}</p>
                        ) : usersList.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead>
                                        <tr>
                                            <th className="py-2 px-4 border-b text-left text-gray-600">UID</th>
                                            <th className="py-2 px-4 border-b text-left text-gray-600">Email</th>
                                            <th className="py-2 px-4 border-b text-left text-gray-600">Rola</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {usersList.map((u) => (
                                            <tr key={u.id} className="hover:bg-gray-50">
                                                <td className="py-2 px-4 border-b">{u.id}</td>
                                                <td className="py-2 px-4 border-b">{u.email || 'N/A'}</td>
                                                {/* Zobrazenie roly používateľa, ak je k dispozícii, inak 'user' */}
                                                <td className="py-2 px-4 border-b">{u.profile && u.profile.data && u.profile.data.role ? u.profile.data.role : 'user'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-600">Žiadni používatelia na zobrazenie.</p>
                        )}
                    </div>
                ) : (
                    // Zobrazenie pre bežných používateľov, ak nie sú administrátori
                    <div className="mt-8 pt-8 border-t border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Dostupné funkcie</h2>
                        <p className="text-gray-600">Ako bežný používateľ máte prístup k vašim osobným údajom a nastaveniam.</p>
                        <p className="text-gray-600 mt-2">Nemáte oprávnenie na zobrazenie zoznamu všetkých používateľov.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
