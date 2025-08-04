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
    const profileCardTitle = userProfileData?.role === 'user' ? 'Údaje kontaktnej osoby' : 'Moje údaje';

    const profileContent = React.createElement(
        'div',
        { className: `flex-1 bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
        React.createElement(
            'div',
            { className: `flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, profileCardTitle),
            // Ceruzka sa zobrazí len ak je `canEdit` true
            canEdit && React.createElement(
                'button',
                {
                    onClick: onOpenProfileModal,
                    className: 'p-2 rounded-full text-white hover:bg-white hover:text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white',
                    'aria-label': 'Upraviť profil'
                },
                React.createElement(
                    'svg',
                    { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                )
            )
        ),
        // Zmena rozloženia údajov
        React.createElement(
            'div',
            { className: 'space-y-6 text-lg' },
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Meno a Priezvisko'),
                React.createElement('div', { className: 'font-normal' }, `${userProfileData.firstName} ${userProfileData.lastName}`)
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Email'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.email)
            ),
            // Podmienka pre zobrazenie telefónneho čísla
            userProfileData.role !== 'admin' && userProfileData.role !== 'hall' &&
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Telefón'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.contactPhoneNumber)
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Adresa'),
                React.createElement('div', { className: 'font-normal' }, `${userProfileData.billing?.street || '-'} ${userProfileData.billing?.houseNumber || '-'}`)
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Mesto'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.city || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'PSČ'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.postalCode || '-')
            ),
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Krajina'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.country || '-')
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
        { className: 'flex-1 bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]' },
        React.createElement(
            'div',
            { className: 'flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white', style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Fakturačné údaje'),
            // Ceruzka sa zobrazí len ak je `canEdit` true
            canEdit && React.createElement(
                'button',
                {
                    onClick: onOpenBillingModal,
                    className: 'p-2 rounded-full text-white hover:bg-white hover:text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white',
                    'aria-label': 'Upraviť fakturačné údaje'
                },
                React.createElement(
                    'svg',
                    { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                )
            )
        ),
        // Zmena rozloženia údajov
        React.createElement(
            'div',
            { className: 'space-y-6 text-gray-700 text-lg' },
            React.createElement('div', null,
                React.createElement('div', { className: 'font-bold text-gray-700 text-sm' }, 'Názov klubu'),
                React.createElement('div', { className: 'font-normal' }, userProfileData.billing?.clubName || '-')
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
        { className: 'flex flex-col gap-8' },
        profileContent,
        billingContent
    );
};


const MyDataApp = ({ userProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    // Nový stav na sledovanie, či je možné dáta upravovať
    const [canEdit, setCanEdit] = useState(false);

    // Ak sa dáta používateľa zmenia, zatvoríme modálne okná
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
        }
    }, [userProfileData]);

    // Časovač na automatické skrytie ceruziek
    useEffect(() => {
        if (userProfileData?.dataEditDeadline) {
            const deadlineMillis = userProfileData.dataEditDeadline.toMillis();
            const nowMillis = Date.now();
            const timeRemaining = deadlineMillis - nowMillis;

            if (timeRemaining > 0) {
                setCanEdit(true);
                const timer = setTimeout(() => {
                    setCanEdit(false);
                }, timeRemaining);
                // Funkcia pre vyčistenie časovača pri odpojení komponentu
                return () => clearTimeout(timer);
            } else {
                // Ak už je po termíne, hneď nastavíme stav na false
                setCanEdit(false);
            }
        }
    }, [userProfileData]);

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

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData }));
            console.log("MyDataApp.js: Aplikácia bola úspešne vykreslená po udalosti 'globalDataUpdated'.");
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
