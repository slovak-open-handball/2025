// logged-in-export.js
// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

/**
 * Skryje hlavičku, ľavé menu a export box, ak URL obsahuje akýkoľvek hash.
 */
const hideHeaderAndMenuIfHash = () => {
    if (window.location.hash && window.location.hash.length > 0) {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const menuPlaceholder = document.getElementById('menu-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.style.display = 'none';
        }
        if (menuPlaceholder) {
            menuPlaceholder.style.display = 'none';
        }
        // Odstránime aj padding-top na body, ktorý bol určený pre pevnú hlavičku
        document.body.style.paddingTop = '0';
        // Odstránime pomocný div pre zbalené menu, ak existuje
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            const spacerDiv = mainContentArea.querySelector('.flex-shrink-0.w-16');
            if (spacerDiv) {
                spacerDiv.style.display = 'none';
            }
        }
        // Skryjeme aj samotný export box (root)
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.style.display = 'none';
        }
    } else {
        // Ak hash nie je prítomný, všetko zobrazíme späť
        const headerPlaceholder = document.getElementById('header-placeholder');
        const menuPlaceholder = document.getElementById('menu-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.style.display = '';
        }
        if (menuPlaceholder) {
            menuPlaceholder.style.display = '';
        }
        document.body.style.paddingTop = '64px';
        const mainContentArea = document.getElementById('main-content-area');
        if (mainContentArea) {
            const spacerDiv = mainContentArea.querySelector('.flex-shrink-0.w-16');
            if (spacerDiv) {
                spacerDiv.style.display = '';
            }
        }
        const rootElement = document.getElementById('root');
        if (rootElement) {
            rootElement.style.display = '';
        }
    }
};

// Okamžite skryjeme hlavičku, menu a export box, ak URL obsahuje hash
hideHeaderAndMenuIfHash();

// Počúvame na zmeny hash v URL (napr. pri navigácii v rámci SPA)
window.addEventListener('hashchange', hideHeaderAndMenuIfHash);

/**
 * Pomocná funkcia - nahradí všetky medzery znakom '-'
 */
const spacesToDashes = (str) => {
    if (!str) return '';
    return str.replace(/\s+/g, '-');
};

/**
 * Pomocná funkcia - nahradí všetky znaky '-' znakom ' ' (medzera)
 */
const dashesToSpaces = (str) => {
    if (!str) return '';
    return str.replace(/-/g, ' ');
};

const ExportApp = ({ userProfileData }) => {
    // Ak URL obsahuje hash, nevykreslíme nič
    if (window.location.hash && window.location.hash.length > 0) {
        return null;
    }

    const [selectedOption, setSelectedOption] = useState('');
    const [categories, setCategories] = useState([]);
    const [groups, setGroups] = useState({});
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedGroupType, setSelectedGroupType] = useState('');
    const [selectedGroupName, setSelectedGroupName] = useState('');
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    // Načítanie kategórií a skupín z Firestore pomocou onSnapshot (real-time)
    useEffect(() => {
        if (selectedOption !== 'tabulky') {
            return;
        }

        setIsLoadingCategories(true);

        // Načítanie kategórií
        const unsubscribeCategories = onSnapshot(
            doc(window.db, 'settings', 'categories'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const categoriesData = docSnap.data();
                    const loadedCategories = Object.keys(categoriesData).map(id => ({
                        id: id,
                        name: categoriesData[id].name
                    }));
                    loadedCategories.sort((a, b) => a.name.localeCompare(b.name));
                    setCategories(loadedCategories);
                } else {
                    setCategories([]);
                }
                setIsLoadingCategories(false);
            },
            (error) => {
                console.error("Chyba pri načítavaní kategórií:", error);
                window.showGlobalNotification('Nastala chyba pri načítavaní kategórií.', 'error');
                setIsLoadingCategories(false);
            }
        );

        // Načítanie skupín
        const unsubscribeGroups = onSnapshot(
            doc(window.db, 'settings', 'groups'),
            (docSnap) => {
                if (docSnap.exists()) {
                    setGroups(docSnap.data());
                } else {
                    setGroups({});
                }
            },
            (error) => {
                console.error("Chyba pri načítavaní skupín:", error);
                window.showGlobalNotification('Nastala chyba pri načítavaní skupín.', 'error');
            }
        );

        return () => {
            unsubscribeCategories();
            unsubscribeGroups();
        };
    }, [selectedOption]);

    // Reset všetkých vybraných hodnôt pri zmene typu exportu
    useEffect(() => {
        setSelectedCategoryId('');
        setSelectedGroupType('');
        setSelectedGroupName('');
    }, [selectedOption]);

    // Reset typu skupiny a skupiny pri zmene kategórie
    useEffect(() => {
        setSelectedGroupType('');
        setSelectedGroupName('');
    }, [selectedCategoryId]);

    // Reset konkrétnej skupiny pri zmene typu skupiny
    useEffect(() => {
        setSelectedGroupName('');
    }, [selectedGroupType]);

    // Dostupné typy skupín pre vybranú kategóriu (unikátne, zoradené: základná, nadstavbová)
    const availableGroupTypes = selectedCategoryId
        ? Array.from(new Set((groups[selectedCategoryId] || []).map(g => g.type))).sort((a, b) => {
            if (a === b) return 0;
            return a === 'základná skupina' ? -1 : 1;
        })
        : [];

    // Dostupné skupiny pre vybranú kategóriu a typ skupiny
    const availableGroups = (selectedCategoryId && selectedGroupType)
        ? (groups[selectedCategoryId] || [])
            .filter(g => g.type === selectedGroupType)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

    // Formátovanie názvu typu pre zobrazenie (prvé písmeno veľké)
    const formatGroupType = (type) => {
        if (!type) return '';
        return type.charAt(0).toUpperCase() + type.slice(1);
    };

    // Podmienka pre aktivovanie tlačidla
    const isGenerateDisabled =
        !selectedOption ||
        (selectedOption === 'tabulky' && (!selectedCategoryId || !selectedGroupType || !selectedGroupName));

    const handleGenerate = () => {
        if (!selectedOption) {
            window.showGlobalNotification('Prosím, vyberte možnosť pred generovaním.', 'error');
            return;
        }

        if (selectedOption === 'tabulky') {
            if (!selectedCategoryId || !selectedGroupType || !selectedGroupName) {
                window.showGlobalNotification('Prosím, vyberte kategóriu, typ skupiny aj konkrétnu skupinu.', 'error');
                return;
            }
            // Získame názov kategórie podľa ID
            const selectedCategory = categories.find(c => c.id === selectedCategoryId);
            const categoryName = selectedCategory ? selectedCategory.name : selectedCategoryId;
            // Nahradíme medzery znakom '-'
            // Typ skupiny sa do URL neukladá
            const categoryNameSafe = spacesToDashes(categoryName);
            const groupNameSafe = spacesToDashes(selectedGroupName);
            const hash = `tabulky/${categoryNameSafe}/${groupNameSafe}`;
            const url = `logged-in-export.html#${hash}`;
            window.open(url, '_blank');
            return;
        }

        // Pre "zapasy"
        const url = `logged-in-export.html#${selectedOption}`;
        window.open(url, '_blank');
    };

    return React.createElement(
        'div',
        { className: 'flex-grow flex justify-center items-center' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8` },
            React.createElement(
                'div',
                { className: `flex flex-col items-center justify-center mb-6 p-4 -mx-8 -mt-8 rounded-t-xl` },
                React.createElement('h2', { className: 'text-3xl font-bold tracking-tight text-center' }, 'Export')
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col gap-6' },
                // Select box - typ exportu
                React.createElement(
                    'div',
                    { className: 'flex flex-col gap-2' },
                    React.createElement(
                        'label',
                        { htmlFor: 'export-option', className: 'text-sm font-medium text-gray-700' },
                        'Vyberte typ exportu'
                    ),
                    React.createElement(
                        'select',
                        {
                            id: 'export-option',
                            value: selectedOption,
                            onChange: (e) => setSelectedOption(e.target.value),
                            className: 'w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700'
                        },
                        React.createElement('option', { value: '' }, '-- Vyberte možnosť --'),
                        React.createElement('option', { value: 'zapasy' }, 'Zápasy v športovej hale'),
                        React.createElement('option', { value: 'tabulky' }, 'Tabuľky')
                    )
                ),

                // Ak je vybrané "Tabuľky" - zobrazíme kategórie, typ skupiny a skupinu
                selectedOption === 'tabulky' && React.createElement(
                    React.Fragment,
                    null,
                    // Select box - kategória
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement(
                            'label',
                            { htmlFor: 'category-option', className: 'text-sm font-medium text-gray-700' },
                            'Vyberte kategóriu'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'category-option',
                                value: selectedCategoryId,
                                onChange: (e) => setSelectedCategoryId(e.target.value),
                                disabled: isLoadingCategories || categories.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(isLoadingCategories || categories.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement(
                                'option',
                                { value: '' },
                                isLoadingCategories
                                    ? '-- Načítavam kategórie... --'
                                    : (categories.length === 0
                                        ? '-- Žiadne kategórie --'
                                        : '-- Vyberte kategóriu --')
                            ),
                            categories.map(cat =>
                                React.createElement('option', { key: cat.id, value: cat.id }, cat.name)
                            )
                        )
                    ),

                    // Select box - typ skupiny
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement(
                            'label',
                            { htmlFor: 'group-type-option', className: 'text-sm font-medium text-gray-700' },
                            'Vyberte typ skupiny'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'group-type-option',
                                value: selectedGroupType,
                                onChange: (e) => setSelectedGroupType(e.target.value),
                                disabled: !selectedCategoryId || availableGroupTypes.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedCategoryId || availableGroupTypes.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement(
                                'option',
                                { value: '' },
                                !selectedCategoryId
                                    ? '-- Najprv vyberte kategóriu --'
                                    : (availableGroupTypes.length === 0
                                        ? '-- Žiadne typy skupín --'
                                        : '-- Vyberte typ skupiny --')
                            ),
                            availableGroupTypes.map((type, idx) =>
                                React.createElement(
                                    'option',
                                    { key: `${type}-${idx}`, value: type },
                                    formatGroupType(type)
                                )
                            )
                        )
                    ),

                    // Select box - konkrétna skupina
                    React.createElement(
                        'div',
                        { className: 'flex flex-col gap-2' },
                        React.createElement(
                            'label',
                            { htmlFor: 'group-option', className: 'text-sm font-medium text-gray-700' },
                            'Vyberte skupinu'
                        ),
                        React.createElement(
                            'select',
                            {
                                id: 'group-option',
                                value: selectedGroupName,
                                onChange: (e) => setSelectedGroupName(e.target.value),
                                disabled: !selectedGroupType || availableGroups.length === 0,
                                className: `w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white text-gray-700 ${(!selectedGroupType || availableGroups.length === 0) ? 'cursor-not-allowed opacity-60' : ''}`
                            },
                            React.createElement(
                                'option',
                                { value: '' },
                                !selectedGroupType
                                    ? '-- Najprv vyberte typ skupiny --'
                                    : (availableGroups.length === 0
                                        ? '-- Žiadne skupiny --'
                                        : '-- Vyberte skupinu --')
                            ),
                            availableGroups.map((group, idx) =>
                                React.createElement(
                                    'option',
                                    { key: `${group.name}-${idx}`, value: group.name },
                                    group.name
                                )
                            )
                        )
                    )
                ),

                // Tlačidlo Generovať (obalené v div, aby cursor-not-allowed fungoval aj na disabled button)
                React.createElement(
                    'div',
                    { className: isGenerateDisabled ? 'cursor-not-allowed' : '' },
                    React.createElement(
                        'button',
                        {
                            onClick: handleGenerate,
                            disabled: isGenerateDisabled,
                            className: `w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md ${!isGenerateDisabled ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-white border-2 border-blue-600 text-blue-600 cursor-not-allowed'}`
                        },
                        'Generovať'
                    )
                )
            )
        )
    );
};

// Export pomocných funkcií, aby boli dostupné aj pri parsovaní hashu v novej karte
window.spacesToDashes = spacesToDashes;
window.dashesToSpaces = dashesToSpaces;


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
            console.log("logged-in-template.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-template.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
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
                                console.log("logged-in-template.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-template.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-template.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(ExportApp, { userProfileData }));
            console.log("logged-in-template.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-template.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
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
        console.error("logged-in-template.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-template.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-template.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-template.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
