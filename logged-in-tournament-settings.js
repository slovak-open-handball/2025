import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// Globálne premenné (budú poskytnuté prostredím Canvas)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY", // Nahraďte skutočným API kľúčom
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Hlavný komponent aplikácie
function App() {
    const [userId, setUserId] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [isAuthenticated, setIsAuthenticated] = React.useState(false);

    // Stav pre nastavenia turnaja
    const [tournamentName, setTournamentName] = React.useState('');
    const [startDate, setStartDate] = React.useState('');
    const [endDate, setEndDate] = React.useState('');
    const [registrationDeadline, setRegistrationDeadline] = React.useState('');
    const [location, setLocation] = React.useState('');
    const [saveMessage, setSaveMessage] = React.useState('');

    // Efekt pre autentifikáciu a načítanie ID používateľa
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthenticated(true);
            } else {
                // Ak nie je prihlásený, skúste sa prihlásiť anonymne alebo pomocou tokenu
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Chyba pri prihlasovaní:", e);
                    setError("Chyba pri prihlasovaní. Skúste to prosím neskôr.");
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Efekt pre načítanie nastavení turnaja z Firestore
    React.useEffect(() => {
        if (userId && isAuthenticated) {
            const tournamentSettingsDocRef = doc(db, `artifacts/${appId}/public/data/tournamentSettings/current`);

            const unsubscribe = onSnapshot(tournamentSettingsDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTournamentName(data.tournamentName || '');
                    setStartDate(data.startDate || '');
                    setEndDate(data.endDate || '');
                    setRegistrationDeadline(data.registrationDeadline || '');
                    setLocation(data.location || '');
                } else {
                    console.log("Dokument nastavení turnaja neexistuje.");
                }
            }, (err) => {
                console.error("Chyba pri načítaní nastavení turnaja:", err);
                setError("Chyba pri načítaní nastavení turnaja.");
            });

            return () => unsubscribe();
        }
    }, [userId, isAuthenticated]); // Závisí od userId a isAuthenticated

    // Funkcia na uloženie nastavení turnaja
    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSaveMessage('');
        setError(null);

        if (!userId) {
            setError("Používateľ nie je prihlásený.");
            setLoading(false);
            return;
        }

        try {
            const tournamentSettingsDocRef = doc(db, `artifacts/${appId}/public/data/tournamentSettings/current`);
            await setDoc(tournamentSettingsDocRef, {
                tournamentName,
                startDate,
                endDate,
                registrationDeadline,
                location,
                lastUpdated: new Date().toISOString(),
                updatedBy: userId
            });
            setSaveMessage("Nastavenia úspešne uložené!");
        } catch (e) {
            console.error("Chyba pri ukladaní nastavení turnaja:", e);
            setError("Chyba pri ukladaní nastavení turnaja. Skúste to prosím neskôr.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
                <div className="text-center text-gray-600">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="mt-4">Načítavam...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-64px)]">
                <div className="text-center text-red-600 p-4 bg-red-100 rounded-lg shadow-md">
                    <p className="font-bold">Chyba:</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 mt-8">
            <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 lg:p-10 max-w-3xl mx-auto">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">Nastavenia turnaja SOH 2025</h2>

                {userId && (
                    <p className="text-sm text-gray-600 mb-6 text-center">
                        Prihlásený ako: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{userId}</span>
                    </p>
                )}

                <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div>
                        <label htmlFor="tournament-name" className="block text-sm font-medium text-gray-700 mb-1">Názov turnaja</label>
                        <input
                            type="text"
                            id="tournament-name"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={tournamentName}
                            onChange={(e) => setTournamentName(e.target.value)}
                            placeholder="Zadajte názov turnaja"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">Dátum začiatku</label>
                            <input
                                type="date"
                                id="start-date"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">Dátum ukončenia</label>
                            <input
                                type="date"
                                id="end-date"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="registration-deadline" className="block text-sm font-medium text-gray-700 mb-1">Termín registrácie</label>
                        <input
                            type="date"
                            id="registration-deadline"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={registrationDeadline}
                            onChange={(e) => setRegistrationDeadline(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Miesto konania</label>
                        <input
                            type="text"
                            id="location"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Napr. Športová hala, Bratislava"
                            required
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
                            disabled={loading}
                        >
                            {loading ? 'Ukladám...' : 'Uložiť nastavenia'}
                        </button>
                    </div>

                    {saveMessage && (
                        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-lg text-center">
                            {saveMessage}
                        </div>
                    )}
                    {error && !saveMessage && ( // Zobraz chybu len ak nie je správa o uložení
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-center">
                            {error}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
