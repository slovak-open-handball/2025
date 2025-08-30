// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
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

// Modal pre vytvorenie skupiny
const CreateGroupModal = ({ isVisible, onClose, categories }) => {
    const [selectedCategory, setSelectedCategory] = useState('');
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('základná skupina');

    if (!isVisible) return null;

    const handleCreateGroup = async () => {
        if (!selectedCategory || !groupName || !groupType) {
            window.showGlobalNotification('Prosím, vyplňte všetky polia.', 'error');
            return;
        }

        try {
            const groupsDocRef = doc(window.db, 'settings', 'groups');
            const newGroup = {
                name: groupName,
                type: groupType,
                creationDate: new Date(),
            };

            await updateDoc(groupsDocRef, {
                [selectedCategory]: arrayUnion(newGroup)
            });

            window.showGlobalNotification('Skupina bola úspešne vytvorená.', 'success');
            onClose(); // Zatvorenie modálneho okna po úspešnom uložení
        } catch (e) {
            // Ak dokument 'groups' neexistuje, vytvoríme ho
            if (e.code === 'not-found') {
                const groupsDocRef = doc(window.db, 'settings', 'groups');
                const newGroup = {
                    name: groupName,
                    type: groupType,
                    creationDate: new Date(),
                };
                await setDoc(groupsDocRef, {
                    [selectedCategory]: [newGroup]
                });
                window.showGlobalNotification('Skupina bola úspešne vytvorená.', 'success');
                onClose();
            } else {
                console.error("Chyba pri pridávaní skupiny: ", e);
                window.showGlobalNotification('Nastala chyba pri vytváraní skupiny.', 'error');
            }
        }
    };

    return React.createElement(
        'div',
        { className: 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50' },
        React.createElement(
            'div',
            { className: 'relative p-5 border w-96 shadow-lg rounded-md bg-white' },
            React.createElement(
                'div',
                { className: 'mt-3 text-center' },
                React.createElement('h3', { className: 'text-lg leading-6 font-medium text-gray-900' }, 'Vytvoriť novú skupinu'),
                React.createElement(
                    'div',
                    { className: 'mt-2 px-7 py-3' },
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Kategória'),
                        React.createElement(
                            'select',
                            {
                                className: 'mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md',
                                value: selectedCategory,
                                onChange: (e) => setSelectedCategory(e.target.value)
                            },
                            React.createElement('option', { value: '' }, 'Vyberte kategóriu'),
                            categories.map(category =>
                                React.createElement('option', { key: category, value: category }, category)
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Názov skupiny'),
                        React.createElement(
                            'input',
                            {
                                type: 'text',
                                className: 'mt-1 block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm',
                                value: groupName,
                                onChange: (e) => setGroupName(e.target.value),
                                placeholder: 'Zadajte názov skupiny'
                            }
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mb-4' },
                        React.createElement('label', { className: 'block text-sm font-medium text-gray-700 mb-1 text-left' }, 'Typ skupiny'),
                        React.createElement(
                            'select',
                            {
                                className: 'mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md',
                                value: groupType,
                                onChange: (e) => setGroupType(e.target.value)
                            },
                            React.createElement('option', { value: 'základná skupina' }, 'Základná skupina'),
                            React.createElement('option', { value: 'nadstavbová skupina' }, 'Nadstavbová skupina')
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'items-center px-4 py-3 sm:flex sm:flex-row-reverse' },
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 w-full px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3',
                            onClick: handleCreateGroup
                        },
                        'Vytvoriť'
                    ),
                    React.createElement(
                        'button',
                        {
                            className: 'flex-1 mt-2 w-full px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 sm:mt-0',
                            onClick: onClose
                        },
                        'Zrušiť'
                    )
                )
            )
        )
    );
};

const AddGroupsApp = ({ userProfileData }) => {
    const [categories, setCategories] = useState([]);
    const [isModalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        const fetchCategories = async () => {
            if (window.db) {
                try {
                    // Správny odkaz na dokument 'categories' v rámci 'settings'
                    const categoriesDocRef = doc(window.db, 'settings', 'categories');
                    const categoriesSnapshot = await getDoc(categoriesDocRef);

                    if (categoriesSnapshot.exists()) {
                        const categoriesData = categoriesSnapshot.data();
                        console.log("Načítané kategórie:");
                        const loadedCategories = [];
                        // Prechádzame cez všetky polia v dokumente
                        for (const key in categoriesData) {
                            if (categoriesData.hasOwnProperty(key) && categoriesData[key].name) {
                                console.log(categoriesData[key].name);
                                loadedCategories.push(categoriesData[key].name);
                            }
                        }
                        // Zoradenie kategórií abecedne
                        loadedCategories.sort((a, b) => a.localeCompare(b));
                        setCategories(loadedCategories);
                    } else {
                        console.log("Dokument 'categories' nebol nájdený v 'settings'.");
                    }
                } catch (error) {
                    console.error("Chyba pri načítavaní kategórií:", error);
                }
            }
        };

        fetchCategories();
    }, []);

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full transform transition-all duration-500 hover:scale-[1.01]` },
            React.createElement(
                'div',
                { className: `w-full flex flex-col items-center justify-center mb-6` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Vytvorenie skupín')
            ),
            React.createElement(
                'div',
                { className: 'flex flex-wrap justify-center gap-4' },
                categories.map((category, index) =>
                    React.createElement(
                        'div',
                        { key: index, className: 'w-1/5 bg-white rounded-lg shadow-md p-4 flex flex-col items-center justify-center text-center' },
                        React.createElement('h3', { className: 'text-lg font-semibold' }, category)
                    )
                )
            )
        ),
        React.createElement(
            'button',
            {
                className: 'fixed bottom-4 right-4 bg-green-500 text-white rounded-full p-4 shadow-lg hover:bg-green-600 transition-colors duration-300',
                onClick: () => setModalVisible(true)
            },
            React.createElement(
                'svg',
                {
                    xmlns: 'http://www.w3.org/2000/svg',
                    className: 'h-6 w-6',
                    fill: 'none',
                    viewBox: '0 0 24 24',
                    stroke: 'currentColor'
                },
                React.createElement('path', {
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                    strokeWidth: 2,
                    d: 'M12 4v16m8-8H4'
                })
            )
        ),
        React.createElement(CreateGroupModal, {
            isVisible: isModalVisible,
            onClose: () => setModalVisible(false),
            categories: categories
        })
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
            console.log("logged-in-add-groups.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-add-groups.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
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
                                console.log("logged-in-add-groups.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-add-groups.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-add-groups.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(AddGroupsApp, { userProfileData }));
            console.log("logged-in-add-groups.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-add-groups.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
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
    console.error("logged-in-add-groups.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-add-groups.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-add-groups.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-add-groups.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
