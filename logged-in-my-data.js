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

const ProfileSection = ({ userProfileData, onOpenProfileModal, onOpenBillingModal }) => {
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
    // Skontrolujeme, či je aktuálny čas menší ako uzávierka pre úpravu dát
    const canEdit = userProfileData?.dataEditDeadline?.toMillis() > Date.now();

    const profileContent = React.createElement(
        'div',
        { className: `flex-1 bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]` },
        React.createElement(
            'div',
            { className: `flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white`, style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Moje údaje'),
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
        React.createElement(
            'div',
            { className: 'space-y-4 text-lg' },
            React.createElement('p', null, React.createElement('strong', null, 'Meno:'), ' ', userProfileData.firstName),
            React.createElement('p', null, React.createElement('strong', null, 'Priezvisko:'), ' ', userProfileData.lastName),
            React.createElement('p', null, React.createElement('strong', null, 'Email:'), ' ', userProfileData.email),
            React.createElement('p', null, React.createElement('strong', null, 'Telefón:'), ' ', userProfileData.contactPhoneNumber),
            userProfileData.role === 'referee' &&
            React.createElement('p', null, React.createElement('strong', null, 'Licencia Rozhodcu:'), ' ', userProfileData.refereeLicense),
            userProfileData.club && userProfileData.club !== '' &&
            React.createElement('p', null, React.createElement('strong', null, 'Klub:'), ' ', userProfileData.club)
        )
    );

    const billingContent = (userProfileData.role === 'admin' || userProfileData.role === 'hall') ? null : React.createElement(
        'div',
        { className: 'flex-1 bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]' },
        React.createElement(
            'div',
            { className: 'flex items-center justify-between mb-6 p-4 -mx-8 -mt-8 rounded-t-xl text-white', style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tight' }, 'Fakturačné údaje'),
            React.createElement(
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
        React.createElement(
            'div',
            { className: 'space-y-4 text-gray-700 text-lg' },
            React.createElement('p', null, React.createElement('strong', null, 'Názov klubu:'), ' ', userProfileData.billing?.clubName || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'Adresa:'), ' ', userProfileData.billing?.street || '-', ' ', userProfileData.billing?.houseNumber || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'Mesto:'), ' ', userProfileData.billing?.city || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'PSČ:'), ' ', userProfileData.billing?.postalCode || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'Krajina:'), ' ', userProfileData.billing?.country || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'IČO:'), ' ', userProfileData.billing?.ico || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'DIČ:'), ' ', userProfileData.billing?.dic || '-'),
            React.createElement('p', null, React.createElement('strong', null, 'IČ DPH:'), ' ', userProfileData.billing?.icdph || '-')
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

    // Ak sa dáta používateľa zmenia, zatvoríme modálne okná
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
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
                onOpenBillingModal: () => setShowBillingModal(true)
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
