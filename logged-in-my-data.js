// Importy pre Firebase funkcie
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged, getAuth, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";


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
        { className: 'w-full max-w-2xl bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]' },
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
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.dic || '-')
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


const MyDataApp = ({ userProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    // Nový stav pre uloženie dát o registrácii z Firestore
    const [registrationDatesData, setRegistrationDatesData] = useState(null);
    const [isRegistrationDataLoading, setIsRegistrationDataLoading] = useState(true);

    // Ak sa dáta používateľa zmenia, zatvoríme modálne okná
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
        }
    }, [userProfileData]);

    // Firestore listener pre dáta o registrácii
    useEffect(() => {
        // Inicializácia Firebase a Auth, ak ešte nie sú globálne dostupné
        let app, db, auth;
        try {
            if (typeof window.__firebase_config !== 'undefined') {
                const firebaseConfig = JSON.parse(window.__firebase_config);
                app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);
            } else {
                console.warn("logged-in-my-data.js: __firebase_config nie je definovaný. Firestore listener nebude nastavený.");
                setIsRegistrationDataLoading(false);
                return;
            }
        } catch (error) {
            console.error("logged-in-my-data.js: Chyba pri inicializácii Firebase pre listener registračných dát:", error);
            setIsRegistrationDataLoading(false);
            return;
        }
        
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const registrationDatesRef = doc(db, 'artifacts', appId, 'public', 'data', 'registrationDates', 'current');
        
        setIsRegistrationDataLoading(true);
        const unsubscribe = onSnapshot(registrationDatesRef, (docSnap) => {
            if (docSnap.exists()) {
                setRegistrationDatesData(docSnap.data());
                console.log("logged-in-my-data.js: Registračné dáta načítané z Firestore.", docSnap.data());
            } else {
                console.log("logged-in-my-data.js: Dokument 'registrationDates' neexistuje.");
                setRegistrationDatesData(null);
            }
            setIsRegistrationDataLoading(false);
        }, (error) => {
            console.error("logged-in-my-data.js: Chyba pri načítavaní registračných dát z Firestore:", error);
            setRegistrationDatesData(null);
            setIsRegistrationDataLoading(false);
        });

        // Funkcia na odhlásenie listenera pri odpojení komponentu
        return () => unsubscribe();
    }, [__app_id]); // Spustí sa iba raz pri pripojení komponentu alebo ak sa zmení appId

    // Vypočítame deadlineMillis z registrationDatesData
    const dataEditDeadline = registrationDatesData?.dataEditDeadline;
    const deadlineMillis = dataEditDeadline ? dataEditDeadline.toMillis() : null;

    // Časovač a logika pre určenie, či je možné dáta upravovať
    useEffect(() => {
        let timer; // Premenná pre časovač

        // Východiskovo nastavíme canEdit na false
        setCanEdit(false);

        // Uistíme sa, že sú dostupné dáta používateľa
        if (!userProfileData) {
            console.log("logged-in-my-data.js: Chýbajú dáta používateľa. Úpravy nie sú povolené.");
            return;
        }

        const isAdmin = userProfileData.role === 'admin';
        
        // Ak je používateľ administrátor, vždy môže upravovať
        // Táto podmienka má najvyššiu prioritu a ak je splnená, ukončí vykonávanie useEffect.
        if (isAdmin) {
            setCanEdit(true);
            console.log("logged-in-my-data.js: Admin môže vždy upravovať. canEdit nastavené na TRUE.");
            return; 
        }

        // Pre ne-admin používateľov skontrolujeme dáta registrácie a deadline.
        // Používame nový stav registrationDatesData a isRegistrationDataLoading
        if (isRegistrationDataLoading || !registrationDatesData || deadlineMillis === null) {
            // Skryjeme tlačidlo, ak sa dáta ešte načítavajú alebo nie sú dostupné
            setCanEdit(false);
            console.log("logged-in-my-data.js: Tlačidlo SKRYTÉ (ne-admin) - registračné dáta sa načítavajú alebo nie sú dostupné.");
            return;
        }

        const nowMillis = Date.now();
            
        // Logging pre diagnostiku
        console.log(`logged-in-my-data.js: dataEditDeadline (millis): ${deadlineMillis}`);
        console.log(`logged-in-my-data.js: Aktuálny čas (millis): ${nowMillis}`);
        console.log(`logged-in-my-data.js: Rozdiel (millis): ${deadlineMillis - nowMillis}`);

        // ZMENA: Zjednotená podmienka pre zobrazenie tlačidla pre NE-ADMIN používateľov
        if (nowMillis <= deadlineMillis) { 
            // Ak je aktuálny čas menší alebo rovný deadline, povoliť úpravy pre VŠETKY ne-admin roly
            setCanEdit(true); // Toto zahŕňa 'user', 'referee', 'coach' atď. pred deadlinom
            console.log("logged-in-my-data.js: Tlačidlo ZOBRAZENÉ pre NE-ADMIN (všetky roly okrem admina) - pred deadline.");

            // Ak už existuje časovač, vyčistíme ho, aby sme predišli duplikáciám
            if (timer) clearTimeout(timer);
            
            // Nastavíme časovač na automatické vypnutie úprav presne po uplynutí deadline
            timer = setTimeout(() => {
                setCanEdit(false);
                console.log("logged-in-my-data.js: Termín úprav uplynul pre ne-admin rolu, zakazujem úpravy.");
            }, deadlineMillis - nowMillis); 
        } else {
            // Deadline už uplynul, zakázať úpravy pre všetky ne-admin roly
            setCanEdit(false);
            console.log("logged-in-my-data.js: Tlačidlo SKRYTÉ pre NE-ADMIN (všetky roly okrem admina) - po deadline.");
        }

        // Funkcia pre vyčistenie časovača pri odpojení komponentu
        return () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [userProfileData, registrationDatesData, isRegistrationDataLoading]); // Závisí od nového stavu registračných dát a ich načítavania

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
                canEdit: canEdit // Odovzdáme stav do podkomponentu
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
