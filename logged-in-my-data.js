// Importy pre Firebase funkcie (Tieto sa nebudú používať na inicializáciu, ale na typy a funkcie)
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

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
 * Funkcia na formátovanie telefónneho čísla
 * Nájdeme predvoľbu a zvyšné číslo rozdelíme na trojčíselné skupiny
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '-';

    // Odstránime všetky medzery
    const cleanNumber = phoneNumber.replace(/\s/g, '');

    // Zoznam predvolieb je zoradený zostupne podľa dĺžky, aby sa najprv našli dlhšie zhody (napr. +1234 pred +1)
    const sortedDialCodes = [...countryDialCodes].sort((a, b) => b.dialCode.length - a.dialCode.length);

    let dialCode = '';
    let restOfNumber = '';

    // Nájdeme zodpovedajúcu predvoľbu
    for (const country of sortedDialCodes) {
        if (cleanNumber.startsWith(country.dialCode)) {
            dialCode = country.dialCode;
            restOfNumber = cleanNumber.substring(country.dialCode.length);
            break;
        }
    }

    // Ak sa predvoľba nenašla, vrátime pôvodné číslo bez formátovania (ale s odstránenými medzerami)
    if (!dialCode) {
        return cleanNumber;
    }

    // Rozdelíme zvyšok čísla na trojčíselné skupiny
    const parts = [];
    for (let i = 0; i < restOfNumber.length; i += 3) {
        parts.push(restOfNumber.substring(i, i + 3));
    }

    // Skontrolujeme, či máme nejaké časti na zobrazenie
    if (parts.length > 0) {
        return `${dialCode} ${parts.join(' ')}`;
    } else {
        return dialCode;
    }
};

const ProfileSection = ({ userProfileData, onOpenProfileModal, onOpenBillingModal, canEdit }) => {
    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff';
            case 'hall':
                return '#b06835';
            case 'user':
                return '#9333EA';
            default:
                return '#1D4ED8';
        }
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    const getFullRoleName = (role) => {
        switch (role) {
            case 'admin':
                return 'Administrátor';
            case 'super-admin':
                return 'Super Administrátor';
            case 'referee':
                return 'Rozhodca';
            case 'athlete':
                return 'Športovec';
            case 'coach':
                return 'Tréner';
            case 'hall':
                return 'Správca haly';
            default:
                return 'Používateľ';
        }
    };

    // Dynamicky nastavíme názov karty podľa roly
    const profileCardTitle = userProfileData?.role === 'user' ? 'Kontaktná osoba' : 'Moje údaje';

    // Dynamicky nastavíme popisky polí
    const nameLabel = userProfileData?.role === 'user' ? 'Meno a priezvisko kontaktnej osoby' : 'Meno a priezvisko';
    const emailLabel = userProfileData?.role === 'user' ? 'E-mailová adresa kontaktnej osoby' : 'E-mailová adresa';
    const phoneLabel = userProfileData?.role === 'user' ? 'Telefónne číslo kontaktnej osoby' : 'Telefónne číslo';

    // Logika pre zobrazenie ceruzky na základe stavu canEdit (odovzdaného z MyDataApp)
    const showProfilePencil = canEdit;
    const showBillingPencil = canEdit;


    const profileContent = React.createElement(
        'div',
        { className: `w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
        React.createElement(
            'div',
            { className: `flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, profileCardTitle),
            // Ceruzka sa zobrazí len ak je canEdit true
            showProfilePencil && React.createElement(
                'button',
                {
                    onClick: onOpenProfileModal,
                    className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                    'aria-label': 'Upraviť profil',
                    style: { color: roleColor }
                },
                React.createElement(
                    'svg',
                    { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                React.createElement('span', { className: 'font-medium' }, 'Upraviť')
            )
        ),
        // Zmena rozloženia údajov
        React.createElement(
            'div',
            { className: 'space-y-6 text-lg' },
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, nameLabel),
                React.createElement('div', { className: 'font-normal' }, `${userProfileData.firstName} ${userProfileData.lastName}`)
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, emailLabel),
                React.createElement('div', { className: 'font-normal' }, userProfileData.email)
            ),
            // Podmienka pre zobrazenie telefónneho čísla
            userProfileData.role !== 'admin' && userProfileData.role !== 'hall' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, phoneLabel),
                React.createElement('div', { className: 'font-normal' }, formatPhoneNumber(userProfileData.contactPhoneNumber))
            ),
            userProfileData.role === 'referee' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Licencia Rozhodcu'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.refereeLicense)
            ),
            userProfileData.club && userProfileData.club !== '' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Klub'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.club)
            )
        )
    );

    const billingContent = (userProfileData.role === 'admin' || userProfileData.role === 'hall') ? null : React.createElement(
        'div',
        { className: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]`' },
        React.createElement(
            'div',
            // OPRAVA: Zmenený backtick na jednoduchú úvodzovku pre správnu syntax
            { className: 'flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white', style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Fakturačné údaje'),
            // Ceruzka sa zobrazí len ak je canEdit true
            showBillingPencil && React.createElement(
                'button',
                {
                    onClick: onOpenBillingModal,
                    className: 'flex items-center space-x-2 px-4 py-2 rounded-full bg-white text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white hover:bg-gray-100',
                    'aria-label': 'Upraviť fakturačné údaje',
                    style: { color: roleColor }
                },
                React.createElement(
                    'svg',
                    { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                React.createElement('span', { className: 'font-medium' }, 'Upraviť')
            )
        ),
        // Zmena rozloženia údajov
        React.createElement(
            'div',
            { className: 'space-y-6 text-gray-700 text-lg' },
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Oficiálny názov klubu'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.clubName || '-')
            ),
            // Zlúčená adresa do jedného riadku
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Adresa'),
                React.createElement('div', { className: 'font-normal' },
                    `${userProfileData.street || '-'} ${userProfileData.houseNumber || '-'}, ${userProfileData.postalCode ? userProfileData.postalCode.slice(0, 3) + ' ' + userProfileData.postalCode.slice(3) : '-'} ${userProfileData.city || '-'}, ${userProfileData.country || '-'}`
                )
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČO'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.ico || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'DIČ'),
                React.createElement('div', { className : 'font-normal' }, userProfileData.billing?.dic || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'IČ DPH'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.icdph || '-')
            )
        )
    );

    return React.createElement(
        'div',
        { className: 'flex flex-col items-center gap-8' },
        profileContent,
        billingContent
    );
};


// Definícia externého store pre globálne window premenné
const globalDataStore = (() => {
    let internalSnapshot = {}; // Stores the last *raw* snapshot of global window variables
    let listeners = new Set(); // Stores callback functions registered by React components

    // Function to get the current state of global variables from window object
    const getGlobalState = () => {
        return {
            isGlobalAuthReady: window.isGlobalAuthReady || false,
            isRegistrationDataLoaded: window.isRegistrationDataLoaded || false,
            isCategoriesDataLoaded: window.isCategoriesDataLoaded || false,
            // registrationDates už nebude v globalDataStore, bude spravované lokálne v MyDataApp
        };
    };

    // Function to notify all subscribed components about a change
    const emitChange = () => {
        const newGlobalState = getGlobalState();
        let changed = false;

        // Simplified comparison: just compare the JSON string representation
        if (JSON.stringify(newGlobalState) !== JSON.stringify(internalSnapshot)) {
            changed = true;
        }
        
        if (changed) {
            internalSnapshot = newGlobalState; // Update the stable internal snapshot
            listeners.forEach(listener => listener()); // Notify React to re-render
        }
    };

    // Initial setup of the internal snapshot
    internalSnapshot = getGlobalState();

    // The 'getSnapshot' function for useSyncExternalStore.
    // It should return a stable reference to the latest data.
    const getSnapshotForReact = () => internalSnapshot;

    // The 'subscribe' function for useSyncExternalStore.
    // It registers callbacks that should be called when the external store changes.
    const subscribeForReact = (callback) => {
        listeners.add(callback);

        // Add event listeners to global window events that might trigger changes
        window.addEventListener('globalDataUpdated', emitChange);
        window.addEventListener('categoriesLoaded', emitChange);
        // Odstránený listener pre 'registrationDatesUpdated', keďže sa budú spravovať lokálne
        
        // Return a cleanup function
        return () => {
            listeners.delete(callback);
            window.removeEventListener('globalDataUpdated', emitChange);
            window.removeEventListener('categoriesLoaded', emitChange);
        };
    };

    return { getSnapshot: getSnapshotForReact, subscribe: subscribeForReact };
})();
// --- END globalDataStore implementation ---


const MyDataApp = ({ userProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    // NOVINKA: Lokálny stav pre registrationDates
    const [localRegistrationDates, setLocalRegistrationDates] = useState(null);

    // Use useSyncExternalStore to synchronize with global data.
    const { 
        isGlobalAuthReady, 
        isRegistrationDataLoaded, 
        isCategoriesDataLoaded, 
    } = useSyncExternalStore(globalDataStore.subscribe, globalDataStore.getSnapshot);

    // Effect na načítanie registrationDates z Firestore priamo v MyDataApp
    useEffect(() => {
        if (!window.db) {
            console.warn("MyDataApp: Firestore databáza nie je inicializovaná pre načítanie registrationDates.");
            return;
        }

        const registrationDocRef = doc(window.db, "settings", "registration");
        const unsubscribe = onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLocalRegistrationDates(data);
                console.log("MyDataApp: Lokálne registrationDates aktualizované (onSnapshot).", data);
            } else {
                setLocalRegistrationDates(null);
                console.warn("MyDataApp: Dokument 'settings/registration' nebol nájdený!");
            }
        }, (error) => {
            console.error("MyDataApp: Chyba pri počúvaní dát o registrácii:", error);
            setLocalRegistrationDates(null);
        });

        // Cleanup function pre odhlásenie z listenera
        return () => unsubscribe();
    }, [window.db]); // Závisí od inštancie Firebase db

    // If user data changes, close modals
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
        }
    }, [userProfileData]);

    // Calculate deadlineMillis from localRegistrationDates
    // Ensure that localRegistrationDates.dataEditDeadline is correctly accessed and converted
    const dataEditDeadline = localRegistrationDates?.dataEditDeadline;
    const deadlineMillis = (dataEditDeadline instanceof Timestamp) ? 
                            dataEditDeadline.toDate().getTime() : 
                            null;


    // Timer and logic to determine if data can be edited
    useEffect(() => {
        let timer; 
        
        const updateCanEditStatus = () => {
            // Default to false and then evaluate
            setCanEdit(false); 

            // Ensure user data and all necessary global data are ready
            if (!userProfileData || !isGlobalAuthReady || !isRegistrationDataLoaded || !isCategoriesDataLoaded || !localRegistrationDates) {
                console.log("logged-in-my-data.js: Chýbajú dáta používateľa alebo globálne dáta hlavičky/lokálne dáta registrácie nie sú pripravené. Úpravy nie sú povolené.");
                return;
            }

            const isAdmin = userProfileData.role === 'admin';
            if (isAdmin) {
                setCanEdit(true);
                console.log("logged-in-my-data.js: Admin môže vždy upravovať. canEdit nastavené na TRUE.");
                return; 
            }

            // For non-admin users, check registration data and deadline
            if (deadlineMillis !== null) { 
                const nowMillis = Date.now();
                
                console.log(`logged-in-my-data.js: dataEditDeadline (millis): ${deadlineMillis}`);
                console.log(`logged-in-my-data.js: Aktuálny čas (millis): ${nowMillis}`);
                console.log(`logged-in-my-data.js: Rozdiel (millis): ${deadlineMillis - nowMillis}`);

                if (nowMillis <= deadlineMillis) { 
                    setCanEdit(true); 
                    console.log("logged-in-my-data.js: Tlačidlo ZOBRAZENÉ pre NE-ADMIN (všetky roly okrem admina) - pred deadline.");

                    // Zrušíme predošlý časovač, ak existuje, aby sme predišli duplikátom alebo nesprávnym oneskoreniam
                    if (timer) clearTimeout(timer);
                    // Nastavíme nový časovač len ak je deadline v budúcnosti
                    if (deadlineMillis - nowMillis > 0) {
                        timer = setTimeout(() => {
                            setCanEdit(false);
                            console.log("logged-in-my-data.js: Termín úprav uplynul pre ne-admin rolu, zakazujem úpravy.");
                        }, deadlineMillis - nowMillis + 100); // Pridáme malé oneskorenie pre istotu
                    }
                } else {
                    setCanEdit(false);
                    console.log("logged-in-my-data.js: Tlačidlo SKRYTÉ pre NE-ADMIN (všetky roly okrem admina) - po deadline.");
                }
            } else {
                setCanEdit(false);
                console.log("logged-in-my-data.js: Tlačidlo SKRYTÉ (ne-admin) - registračné dáta nie sú načítané/dostupné/platné (deadlineMillis je null).");
            }
        };

        // Zavolaj funkciu hneď pri prvom renderovaní a pri každej zmene závislostí
        updateCanEditStatus();

        // Čistiacia funkcia pre useEffect
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [userProfileData, isGlobalAuthReady, isRegistrationDataLoaded, isCategoriesDataLoaded, localRegistrationDates, deadlineMillis]); 
    // Dependencies now include localRegistrationDates

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff';
            case 'hall':
                return '#b06835';
            case 'user':
                return '#9333EA';
            default:
                return '#1D4ED8';
        }
    };
    const roleColor = getRoleColor(userProfileData?.role) || '#1D4ED8';

    return React.createElement(
        'div',
        { className: 'flex-grow' },
        React.createElement(
            ProfileSection,
            {
                userProfileData: userProfileData,
                onOpenProfileModal: () => setShowProfileModal(true),
                onOpenBillingModal: () => setShowBillingModal(true),
                canEdit: canEdit // Pass state to sub-component
            }
        ),
        React.createElement(
            ChangeProfileModal,
            {
                show: showProfileModal,
                onClose: () => setShowProfileModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor
            }
        ),
        React.createElement(
            ChangeBillingModal,
            {
                show: showBillingModal,
                onClose: () => setShowBillingModal(false),
                userProfileData: userProfileData,
                roleColor: roleColor
            }
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
            console.log("logged-in-my-data.js: Nastavujem poslucháča na synchronizáciu e-mailu.");
            
            onAuthStateChanged(window.auth, async (user) => {
                if (user) {
                    try {
                        const userProfileRef = doc(window.db, 'users', user.uid);
                        const docSnap = await getDoc(userProfileRef);
            
                        if (docSnap.exists()) {
                            const firestoreEmail = docSnap.data().email;
                            if (user.email !== firestoreEmail) {
                                console.log(`logged-in-my-data.js: E-mail v autentifikácii (${user.email}) sa líši od e-mailu vo Firestore (${firestoreEmail}). Aktualizujem...`);
                                
                                await updateDoc(userProfileRef, {
                                    email: user.email
                                });
            
                                // Vytvorenie notifikácie v databáze s novou štruktúrou
                                const notificationsCollectionRef = collection(window.db, 'notifications');
                                await addDoc(notificationsCollectionRef, {
                                    userEmail: user.email,
                                    changes: `Zmena e-mailovej adresy z '${firestoreEmail}' na '${user.email}'.`,
                                    timestamp: new Date()
                                });
                                
                                window.showGlobalNotification('E-mailová adresa bola automaticky aktualizovaná a synchronizovaná.', 'success');
                                console.log("logged-in-my-data.js: E-mail vo Firestore bol aktualizovaný a notifikácia vytvorená.");
            
                            } else {
                                console.log("logged-in-my-data.js: E-maily sú synchronizované, nie je potrebné nič aktualizovať.");
                            }
                        }
                    } catch (error) {
                        console.error("logged-in-my-data.js: Chyba pri porovnávaní a aktualizácii e-mailu:", error);
                        window.showGlobalNotification('Nastala chyba pri synchronizácii e-mailovej adresy.', 'error');
                    }
                }
            });
            isEmailSyncListenerSetup = true; // Označíme, že poslucháč je nastavený
        }

        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData }));
            console.log("logged-in-my-data.js: Aplikácia bola vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("logged-in-my-data.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
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
        console.error("logged-in-my-data.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'. Zobrazujem loader.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("logged-in-my-data.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("logged-in-my-data.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("logged-in-my-data.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
