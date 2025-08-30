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
    const [allGroupsByCategoryId, setAllGroupsByCategoryId] = useState({});
    const [categoryIdToNameMap, setCategoryIdToNameMap] = useState({});

    useEffect(() => {
        if (!window.db) {
            console.error("Firebase Firestore nie je inicializovaný.");
            return;
        }

        const usersRef = collection(window.db, 'users');
        const groupsRef = doc(window.db, 'settings', 'groups');
        const categoriesRef = doc(window.db, 'settings', 'categories');
        
        // Listener na zmeny v kolekcii 'users' (pre tímy)
        const unsubscribeTeams = onSnapshot(usersRef, (querySnapshot) => {
            console.log("onSnapshot: Načítavam tímy z kolekcie 'users'...");
            const teamsList = [];
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData && userData.teams) {
                    Object.entries(userData.teams).forEach(([categoryName, teamArray]) => {
                        if (Array.isArray(teamArray)) {
                            teamArray.forEach(team => {
                                if (team.teamName) {
                                    teamsList.push({ category: categoryName, teamName: team.teamName });
                                }
                            });
                        }
                    });
                }
            });
            setAllTeams(teamsList);
            console.log("onSnapshot: Celkový zoznam tímov aktualizovaný:", teamsList);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní tímov: ", error);
        });

        // Listener na zmeny v dokumente 'categories'
        const unsubscribeCategories = onSnapshot(categoriesRef, (docSnap) => {
            console.log("onSnapshot: Načítavam kategórie...");
            const categoryIdToName = {};
            if (docSnap.exists()) {
                const categoryData = docSnap.data();
                Object.entries(categoryData).forEach(([categoryId, categoryObject]) => {
                    if (categoryObject && categoryObject.name) {
                        categoryIdToName[categoryId] = categoryObject.name;
                    }
                });
            } else {
                console.log("onSnapshot: Dokument s kategóriami nebol nájdený!");
            }
            setCategoryIdToNameMap(categoryIdToName);
            console.log("onSnapshot: Mapa kategórií aktualizovaná:", categoryIdToName);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní kategórií: ", error);
        });

        // Listener na zmeny v dokumente 'groups'
        const unsubscribeGroups = onSnapshot(groupsRef, (docSnap) => {
            console.log("onSnapshot: Načítavam skupiny...");
            const groupsByCategoryId = {};
            if (docSnap.exists()) {
                const groupData = docSnap.data();
                Object.entries(groupData).forEach(([categoryId, groupArray]) => {
                    if (Array.isArray(groupArray)) {
                        groupsByCategoryId[categoryId] = groupArray.map(group => ({
                            name: group.name,
                            type: group.type
                        }));
                    }
                });
            } else {
                console.log("onSnapshot: Dokument so skupinami nebol nájdený!");
            }
            setAllGroupsByCategoryId(groupsByCategoryId);
            console.log("onSnapshot: Skupiny rozdelené podľa kategórií aktualizované:", groupsByCategoryId);
        }, (error) => {
            console.error("onSnapshot: Chyba pri načítaní skupín: ", error);
        });
        
        // Funkcia na vyčistenie poslucháčov pri odpojení komponentu
        return () => {
            unsubscribeTeams();
            unsubscribeCategories();
            unsubscribeGroups();
            console.log("onSnapshot: Všetci poslucháči boli zrušení.");
        };

    }, []);

    const renderTeamList = () => {
        if (allTeams.length === 0) {
            return React.createElement(
                'p',
                { className: 'text-center text-gray-500' },
                'Žiadne tímy neboli nájdené.'
            );
        }
        
        // Zoradíme tímy podľa názvu kategórie
        const sortedTeams = [...allTeams].sort((a, b) => a.category.localeCompare(b.category));
        
        return React.createElement(
            'ul',
            { className: 'space-y-2' },
            sortedTeams.map((team, index) =>
                React.createElement(
                    'li',
                    { key: index, className: 'px-4 py-2 bg-gray-100 rounded-lg text-gray-700' },
                    `${team.category}: ${team.teamName}`
                )
            )
        );
    };

    const renderGroupedCategories = () => {
        if (Object.keys(allGroupsByCategoryId).length === 0) {
            return React.createElement(
                'div',
                { className: 'w-full max-w-xl mx-auto' },
                React.createElement(
                    'p',
                    { className: 'text-center text-gray-500' },
                    'Žiadne skupiny neboli nájdené.'
                )
            );
        }

        // Získame a zoradíme kľúče (ID kategórií) na základe názvov kategórií
        const sortedCategoryIds = Object.keys(allGroupsByCategoryId).sort((a, b) => {
            const nameA = categoryIdToNameMap[a] || '';
            const nameB = categoryIdToNameMap[b] || '';
            return nameA.localeCompare(nameB);
        });

        return React.createElement(
            'div',
            { className: 'flex flex-wrap justify-start gap-4 flex-grow' },
            sortedCategoryIds.map((categoryId, index) => {
                const groups = allGroupsByCategoryId[categoryId];
                const categoryName = categoryIdToNameMap[categoryId] || "Neznáma kategória";
                
                const sortedGroups = [...groups].sort((a, b) => {
                    // Typ "základná skupina" má prednosť
                    if (a.type === 'základná skupina' && b.type !== 'základná skupina') {
                        return -1;
                    }
                    if (b.type === 'základná skupina' && a.type !== 'základná skupina') {
                        return 1;
                    }
                    
                    // Ostatné typy sa radia abecedne
                    return a.name.localeCompare(b.name);
                });
                
                return React.createElement(
                    'div',
                    { key: index, className: 'flex flex-col bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01] mb-6 min-w-[300px]' },
                    React.createElement(
                        'h3',
                        { className: 'text-2xl font-semibold mb-4 text-center' },
                        categoryName
                    ),
                    React.createElement(
                        'ul',
                        { className: 'space-y-2' },
                        sortedGroups.map((group, groupIndex) =>
                            React.createElement(
                                'li',
                                { key: groupIndex, className: 'px-4 py-2 bg-gray-100 rounded-lg text-gray-700' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement(
                                        'p',
                                        { className: 'font-semibold' },
                                        group.name
                                    ),
                                    React.createElement(
                                        'p',
                                        { className: 'text-sm text-gray-500' },
                                        group.type
                                    )
                                )
                            )
                        )
                    )
                );
            })
        );
    };

    return React.createElement(
        'div',
        { className: 'flex-grow flex flex-col justify-center items-center' },
        React.createElement('h2', { className: 'text-4xl font-extrabold tracking-tight text-center text-gray-800 mb-8' }, 'Tímy do skupín'),
        React.createElement(
            'div',
            { className: 'flex flex-col md:flex-row justify-center space-x-0 md:space-x-4 w-full px-4' },
            React.createElement(
                'div',
                { className: `w-full max-w-sm bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01] mb-6 flex-shrink-0` },
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
            ),
            React.createElement(
                'div',
                { className: 'flex-grow' },
                renderGroupedCategories()
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
