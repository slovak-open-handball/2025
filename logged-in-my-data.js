// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

const { useState, useEffect, useRef } = React;

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

    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-500';
        textColorClass = 'text-white';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-500';
        textColorClass = 'text-white';
    } else {
        bgColorClass = 'bg-gray-800';
        textColorClass = 'text-white';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    // Zviditeľníme notifikáciu
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 100);

    // Skryjeme notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};


/**
 * Funkcia na získanie farby na základe roly používateľa.
 */
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

/**
 * Hlavný komponent aplikácie, ktorý zobrazuje údaje používateľa.
 */
const MyDataApp = ({ userProfileData, roleColor }) => {
    const [showChangeProfileModal, setShowChangeProfileModal] = useState(false);
    const [showChangeBillingModal, setShowChangeBillingModal] = useState(false);
    const [localProfileData, setLocalProfileData] = useState(userProfileData);
    const [isEditingAllowed, setIsEditingAllowed] = useState(false); // Nový stav pre povolenie úprav
    const deadlineTimerRef = useRef(null); // Ref pre uloženie ID časovača

    const db = getFirestore();
    const auth = getAuth();

    // Načítanie dátumu uzávierky úprav z databázy pomocou onSnapshot pre real-time aktualizácie
    useEffect(() => {
        // Ak je používateľ admin, povolia sa úpravy okamžite a ignoruje sa uzávierka
        if (userProfileData.role === 'admin') {
            setIsEditingAllowed(true);
        } else {
             // Vytvorenie referencie na dokument aktuálneho používateľa
             const userDocRef = doc(db, 'users', userProfileData.id);
            const unsubscribe = onSnapshot(userDocRef, (userSnap) => {
                // Vyčistíme predchádzajúci časovač, ak existuje
                if (deadlineTimerRef.current) {
                    clearTimeout(deadlineTimerRef.current);
                }
    
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    if (data.dataEditDeadline) {
                        const deadline = data.dataEditDeadline.toDate(); // Konvertujeme Firestore Timestamp na JavaScript Date objekt
                        const now = new Date();
                        const isAllowed = now < deadline;
                        setIsEditingAllowed(isAllowed); // Nastavíme stav podľa porovnania
    
                        // Ak sú úpravy povolené, nastavíme časovač, aby sa automaticky zakázali po uplynutí termínu
                        if (isAllowed) {
                            const timeRemaining = deadline.getTime() - now.getTime();
                            deadlineTimerRef.current = setTimeout(() => {
                                setIsEditingAllowed(false);
                                window.showGlobalNotification("Termín pre úpravu dát vypršal.", "error");
                            }, timeRemaining);
                        }
                    } else {
                        // Ak hodnota dataEditDeadline neexistuje, zakážeme úpravy
                        setIsEditingAllowed(false);
                    }
                } else {
                    // Ak dokument neexistuje, taktiež zakážeme úpravy
                    setIsEditingAllowed(false);
                }
            }, (error) => {
                console.error("Error fetching dataEditDeadline:", error);
                // V prípade chyby tiež zakážeme úpravy
                setIsEditingAllowed(false);
            });
    
            // Funkcia na vyčistenie časovača a odhlásenie odberu
            return () => {
                if (deadlineTimerRef.current) {
                    clearTimeout(deadlineTimerRef.current);
                }
                unsubscribe();
            };
        }
    }, [db, userProfileData.id, userProfileData.role]);

    // Nový useEffect na synchronizáciu e-mailu z Authentication s Firestore
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user && localProfileData) {
                // Vytvorenie referencie na dokument aktuálneho používateľa
                const userDocRef = doc(db, 'users', user.uid);
                
                try {
                    const userSnap = await getDoc(userDocRef);
                    if (userSnap.exists()) {
                        const firestoreEmail = userSnap.data().email;
                        const authEmail = user.email;

                        if (firestoreEmail !== authEmail) {
                            // Ak sa e-maily nezhodujú, aktualizujeme Firestore
                            await updateDoc(userDocRef, {
                                email: authEmail,
                            });
                            
                            // Vytvoríme notifikáciu v databáze
                            await addDoc(collection(db, 'notifications'), {
                                userId: user.uid,
                                message: `E-mailová adresa používateľa ${user.uid} bola aktualizovaná z "${firestoreEmail}" na "${authEmail}".`,
                                timestamp: new Date(),
                                type: 'email_update',
                            });

                            console.log("E-mailová adresa v databáze Firestore bola aktualizovaná.");
                        }
                    }
                } catch (error) {
                    console.error("Chyba pri aktualizácii e-mailu alebo vytváraní notifikácie:", error);
                }
            }
        });

        return () => unsubscribeAuth();
    }, [auth, db, localProfileData]);


    // Synchronizácia lokálnych dát, ak sa zmenia globálne dáta
    useEffect(() => {
        setLocalProfileData(userProfileData);
    }, [userProfileData]);

    if (!localProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-full' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500' })
        );
    }
    
    // Nová podmienka na skrytie fakturačných údajov pre admin a hall role
    const hideBillingSection = localProfileData.role === 'admin' || localProfileData.role === 'hall';
    
    // Spojenie krstného mena a priezviska do jedného reťazca pre zobrazenie
    const fullName = `${localProfileData.firstName || ''} ${localProfileData.lastName || ''}`.trim();

    // Nová logika pre dynamický nadpis na základe roly
    const profileTitle = localProfileData.role === 'user' ? 'Údaje kontaktnej osoby' : 'Moje údaje';


    // Komponent pre zobrazenie jedného riadku údajov
    const DataRow = ({ label, value }) => {
        const displayValue = value || '-';
        const valueColorClass = value ? 'text-gray-800' : 'text-gray-400';
        return React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('p', { className: 'text-sm font-medium text-gray-500' }, label),
            React.createElement('p', { className: `text-lg font-semibold ${valueColorClass}` }, displayValue)
        );
    };
    
    // Upravená ikona ceruzky bez spodného štvorca
    const PencilIcon = ({ color }) => (
        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: color, className: "w-4 h-4 mr-2" },
            React.createElement("path", { d: "M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" })
        )
    );
    
    // Formátovanie PSČ
    const formatPostalCode = (pc) => {
        if (!pc || typeof pc !== 'string' || pc.length !== 5) {
            return pc;
        }
        return `${pc.substring(0, 3)} ${pc.substring(3)}`;
    };

    // Spojenie adresných údajov do jedného reťazca
    const formattedAddress = localProfileData.street && localProfileData.houseNumber && localProfileData.postalCode && localProfileData.city && localProfileData.country ?
        `${localProfileData.street} ${localProfileData.houseNumber}, ${formatPostalCode(localProfileData.postalCode)} ${localProfileData.city}, ${localProfileData.country}` :
        '-';

    /**
     * Funkcia na formátovanie telefónneho čísla.
     * Nájdeme predvoľbu a zvyšok čísla rozdelíme do skupín po troch čísliciach.
     */
    const formatPhoneNumber = (phoneNumber) => {
        if (!phoneNumber) {
            return '-';
        }

        // Odstránime medzery a pomlčky pre jednoduchšie spracovanie
        const cleanNumber = phoneNumber.replace(/[\s-]/g, '');

        // Získame a zoradíme predvoľby zostupne podľa dĺžky, aby sme našli najdlhšiu možnú zhodu
        const sortedDialCodes = countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length);

        // Hľadáme zhodu predvoľby v čísle
        let dialCodeMatch = null;
        for (const country of sortedDialCodes) {
            if (cleanNumber.startsWith(country.dialCode)) {
                dialCodeMatch = country.dialCode;
                break;
            }
        }

        if (dialCodeMatch) {
            const numberWithoutDialCode = cleanNumber.substring(dialCodeMatch.length);
            // Rozdelíme zvyšok čísla do skupín po troch čísliciach
            const formattedRest = numberWithoutDialCode.match(/.{1,3}/g)?.join(' ') || '';
            return `${dialCodeMatch} ${formattedRest}`;
        }

        // Ak sa predvoľba nenájde, formátujeme celé číslo po troch čísliciach
        return cleanNumber.match(/.{1,3}/g)?.join(' ') || cleanNumber;
    };


    return React.createElement(
        'div',
        { className: 'flex justify-center p-4' },
        React.createElement(
            'div',
            { className: 'w-full max-w-4xl' },
            // Sekcia s hlavnými údajmi o profile
            React.createElement(
                'div',
                { className: 'bg-white rounded-b-xl shadow-md overflow-hidden mb-6' },
                // Header bloku Moje údaje
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between p-4 rounded-t-xl', style: { backgroundColor: roleColor } },
                    // Dynamický nadpis pre sekciu Moje údaje
                    React.createElement('h2', { className: 'text-2xl font-bold text-white' }, profileTitle),
                    // Tlačidlo na úpravu profilu, zobrazené len ak sú úpravy povolené
                    isEditingAllowed && React.createElement(
                        'button',
                        {
                            onClick: () => setShowChangeProfileModal(true),
                            className: 'flex items-center text-sm font-semibold px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 shadow-md',
                            style: { backgroundColor: 'white', color: roleColor }
                        },
                        React.createElement(PencilIcon, { color: roleColor }),
                        'Upraviť'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6 grid grid-cols-1 md:grid-cols-2 gap-4' },
                    // Upravený riadok pre meno a priezvisko
                    React.createElement(DataRow, { label: 'Meno a priezvisko', value: fullName }),
                    React.createElement(DataRow, { label: 'E-mail', value: localProfileData.email }),
                    // Podmienka na zobrazenie telefónneho čísla
                    localProfileData.role !== 'admin' && localProfileData.role !== 'hall' && React.createElement(DataRow, { label: 'Telefónne číslo', value: formatPhoneNumber(localProfileData.contactPhoneNumber) })
                )
            ),
            
            // Podmienka na zobrazenie sekcie s fakturačnými údajmi
            !hideBillingSection && React.createElement(
                'div',
                { className: 'bg-white rounded-b-xl shadow-md overflow-hidden' },
                // Header bloku Fakturačné údaje
                React.createElement(
                    'div',
                    { className: 'flex items-center justify-between p-4 rounded-t-xl', style: { backgroundColor: roleColor } },
                    React.createElement('h2', { className: 'text-2xl font-bold text-white' }, 'Fakturačné údaje'),
                    // Tlačidlo na úpravu fakturačných údajov, zobrazené len ak sú úpravy povolené
                    isEditingAllowed && React.createElement(
                        'button',
                        {
                            onClick: () => setShowChangeBillingModal(true),
                            className: 'flex items-center text-sm font-semibold px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 shadow-md',
                            style: { backgroundColor: 'white', color: roleColor }
                        },
                        React.createElement(PencilIcon, { color: roleColor }),
                        'Upraviť'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-6 grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement(DataRow, { label: 'Oficiálny názov klubu', value: localProfileData.billing?.clubName }),
                    // Zobrazenie spojeného adresného riadku
                    React.createElement(DataRow, { label: 'Fakturačná adresa', value: formattedAddress }),
                    React.createElement(DataRow, { label: 'IČO', value: localProfileData.billing?.ico }),
                    React.createElement(DataRow, { label: 'DIČ', value: localProfileData.billing?.dic }),
                    React.createElement(DataRow, { label: 'IČ DPH', value: localProfileData.billing?.icdph })
                )
            )
        ),
        
        // Modálne okno pre zmenu profilu
        isEditingAllowed && React.createElement(ChangeProfileModal, {
            show: showChangeProfileModal,
            onClose: () => setShowChangeProfileModal(false),
            userProfileData: localProfileData,
            roleColor: roleColor
        }),
        
        // Modálne okno pre zmenu fakturačných údajov
        isEditingAllowed && React.createElement(ChangeBillingModal, {
            show: showChangeBillingModal,
            onClose: () => setShowChangeBillingModal(false),
            userProfileData: localProfileData,
            roleColor: roleColor
        })
    );
};

/**
 * Počiatočná inicializácia a vykreslenie aplikácie.
 */
const handleDataUpdateAndRender = (event) => {
    const data = event.detail;
    if (data) {
        const rootElement = document.getElementById('root');
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const userRole = data.role;
            const roleColor = getRoleColor(userRole);
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData: data, roleColor: roleColor }));
            console.log("MyDataApp.js: Aplikácia úspešne vykreslená po udalosti 'globalDataUpdated'.");
        } else {
            console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
    } else {
        console.error("MyDataApp.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'.");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("MyDataApp.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("MyDataApp.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("MyDataApp.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
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
