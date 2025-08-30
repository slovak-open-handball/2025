// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, query, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";


const { useState, useEffect, useRef, useSyncExternalStore } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};


const AddGroupsApp = ({ userProfileData }) => {
    const [allTeams, setAllTeams] = useState([]);

    useEffect(() => {
        if (!window.db) {
            console.error("Firebase Firestore nie je inicializovaný.");
            return;
        }

        const fetchAllTeams = async () => {
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const usersRef = collection(window.db, `artifacts/${appId}/public/data/users`);
            const teamsList = [];

            try {
                const querySnapshot = await getDocs(usersRef);
                querySnapshot.forEach((doc) => {
                    const userData = doc.data();
                    if (userData && userData.teams) {
                        // Iterovanie cez tímy v užívateľskom profile
                        Object.values(userData.teams).forEach(category => {
                            if (category.teamName) {
                                teamsList.push(category.teamName);
                            }
                        });
                    }
                });
                setAllTeams(teamsList);
            } catch (e) {
                console.error("Chyba pri načítaní tímov: ", e);
            }
        };

        // Načítanie tímov pri štarte
        fetchAllTeams();
    }, []);

    const renderTeamList = () => {
        if (allTeams.length === 0) {
            return React.createElement(
                'p',
                { className: 'text-center text-gray-500' },
                'Žiadne tímy neboli nájdené.'
            );
        }
        return React.createElement(
            'ul',
            { className: 'space-y-2' },
            allTeams.map((teamName, index) =>
                React.createElement(
                    'li',
                    { key: index, className: 'px-4 py-2 bg-gray-100 rounded-lg text-gray-700' },
                    teamName
                )
            )
        );
    };

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
            React.createElement(
                'div',
                { className: `flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Tímy do skupín')
            ),
            React.createElement(
                'div',
                { className: 'mt-8' },
                React.createElement(
                    'h3',
                    { className: 'text-2xl font-semibold mb-4 text-center' },
                    'Zoznam všetkých tímov'
                ),
                renderTeamList()
            )
        )
    );
};


// Premenná na sledovanie, či bol poslucháč už nastavený
let isEmailSyncListenerSetup = false;

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        // Ak sa dáta načítali, nastavíme poslucháča na synchronizáciu e-mailu, ak ešte nebol nastavený
        // Používame window.auth a window.db, ktoré by mali byť nastavené pri načítaní aplikácie.
        if (window.auth && window.db && !isEmailSyncListenerSetup) {
            console.log("logged-in-teams-in-groups.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-teams-in-groups.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                // Vytvorenie notifikácie v databáze s novou štruktúrou
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email, // Používame userEmail namiesto userId a userName
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date(), // Používame timestamp namiesto createdAt
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                console.log("logged-in-teams-in-groups.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-teams-in-groups.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-teams-in-groups.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("logged-in-teams-in-groups.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-teams-in-groups.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
    } else {
        // Ak dáta nie sú dostupné, zobrazíme loader
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(
                React.createElement(
                    'div',
                    { className: 'flex justify-center items-center h-full pt-16' },
                    React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
                )
            );
        }
        console.error("logged-in-teams-in-groups.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-teams-in-groups.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-teams-in-groups.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-teams-in-groups.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // Ak dáta nie sú dostupné, čakáme na event listener, zatiaľ zobrazíme loader
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
