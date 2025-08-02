// Importy pre Firebase funkcie, aby sa dali použiť v React komponente
import { doc, getFirestore, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentov pre modálne okná
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js"; // Nový import

const { useState, useEffect } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else { // 'info'
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;
    notificationElement.style.opacity = '1';

    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};

const getRoleColor = (role) => {
    switch (role) {
        case 'organizator':
            return '#F97316'; // Orange
        case 'ucastnik':
            return '#10B981'; // Green
        case 'host':
            return '#6366F1'; // Indigo
        default:
            return '#6B7280'; // Gray
    }
};

/**
 * Komponent na zobrazovanie údajov používateľa a modálneho okna na ich zmenu.
 */
const MyDataApp = ({ initialData, roleColor }) => {
    const [userProfileData, setUserProfileData] = useState(initialData);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false); // Nový stav pre druhé modálne okno

    useEffect(() => {
        // Tento listener bude počúvať na zmeny v globálnych dátach
        const handleDataUpdate = (event) => {
            console.log("MyDataApp: Prijatá udalosť globalDataUpdated", event.detail);
            setUserProfileData(event.detail);
        };

        window.addEventListener('globalDataUpdated', handleDataUpdate);

        // Upratovanie pri odmontovaní komponentu
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Ak dáta ešte neboli načítané, zobrazíme načítavací spinner
    if (!userProfileData) {
        return (
            React.createElement('div', { className: 'flex justify-center pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }

    // Pomocná funkcia pre získanie textu podľa roly
    const getRoleText = (role) => {
        switch (role) {
            case 'organizator':
                return 'Organizátor';
            case 'ucastnik':
                return 'Účastník';
            case 'host':
                return 'Hosť';
            default:
                return 'Neznáma rola';
        }
    };

    const UserDataRow = ({ label, value }) => {
        return React.createElement('div', { className: 'flex justify-between items-center py-4 border-b border-gray-200' },
            React.createElement('span', { className: 'text-gray-500 text-sm sm:text-base' }, label),
            React.createElement('span', { className: 'font-medium text-gray-900 text-sm sm:text-base' }, value)
        );
    };

    const SectionTitle = ({ title, onClick, buttonText = 'Upraviť' }) => {
        return React.createElement('div', { className: 'flex justify-between items-center mb-4' },
            React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, title),
            onClick && React.createElement('button', {
                className: `px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2`,
                style: { backgroundColor: roleColor },
                onClick: onClick
            }, buttonText)
        );
    };

    return React.createElement('div', { className: 'min-h-screen flex flex-col items-center p-4 bg-gray-100' },
        React.createElement('div', { className: 'w-full max-w-4xl p-6 bg-white shadow-xl rounded-2xl mb-8' },
            React.createElement('div', { className: 'flex items-center space-x-4 mb-6' },
                React.createElement('div', {
                    className: 'w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold',
                    style: { backgroundColor: roleColor }
                }, userProfileData.first_name ? userProfileData.first_name[0] + userProfileData.last_name[0] : ''),
                React.createElement('div', { className: 'flex-1' },
                    React.createElement('h1', { className: 'text-3xl font-bold text-gray-900' }, `${userProfileData.first_name || ''} ${userProfileData.last_name || ''}`),
                    React.createElement('p', { className: 'text-lg text-gray-500' }, getRoleText(userProfileData.role))
                )
            )
        ),

        React.createElement('div', { className: 'w-full max-w-4xl p-6 bg-white shadow-xl rounded-2xl' },
            React.createElement(SectionTitle, {
                title: 'Moje údaje',
                onClick: () => setShowProfileModal(true)
            }),
            React.createElement('div', { className: 'space-y-2' },
                React.createElement(UserDataRow, { label: 'Meno a Priezvisko', value: `${userProfileData.first_name || ''} ${userProfileData.last_name || ''}` }),
                React.createElement(UserDataRow, { label: 'E-mailová adresa', value: userProfileData.email }),
                React.createElement(UserDataRow, { label: 'Telefónne číslo', value: userProfileData.phone || 'Neuvedené' })
            ),
            React.createElement('hr', { className: 'my-6 border-gray-200' }),
            React.createElement(SectionTitle, {
                title: 'Fakturačné údaje',
                onClick: () => setShowBillingModal(true) // Nové tlačidlo na otvorenie billing modalu
            }),
            React.createElement('div', { className: 'space-y-2' },
                React.createElement(UserDataRow, { label: 'Adresa', value: userProfileData.billing_address || 'Neuvedené' }),
                React.createElement(UserDataRow, { label: 'Mesto', value: userProfileData.billing_city || 'Neuvedené' }),
                React.createElement(UserDataRow, { label: 'PSČ', value: userProfileData.billing_zip || 'Neuvedené' }),
                React.createElement(UserDataRow, { label: 'Krajina', value: userProfileData.billing_country || 'Neuvedené' })
            )
        ),

        // Modálne okná
        React.createElement(ChangeProfileModal, {
            show: showProfileModal,
            onClose: () => setShowProfileModal(false),
            userProfileData: userProfileData,
            roleColor: roleColor
        }),
        React.createElement(ChangeBillingModal, { // Nový komponent
            show: showBillingModal,
            onClose: () => setShowBillingModal(false),
            userProfileData: userProfileData,
            roleColor: roleColor
        })
    );
};

// Funkcia na vykreslenie aplikácie
const renderApp = (data) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const userRole = data?.role;
        const roleColor = getRoleColor(userRole);
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { initialData: data, roleColor: roleColor }));
        console.log("MyDataApp.js: Aplikácia bola vykreslená s počiatočnými dátami.");
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
}

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'
console.log("MyDataApp.js: Registrujem poslucháča pre 'globalDataUpdated'.");
const handleGlobalDataUpdate = (event) => {
    console.log("MyDataApp.js: Prijatá udalosť globalDataUpdated, vykresľujem aplikáciu.");
    renderApp(event.detail);
};

window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("MyDataApp.js: Kontrolujem, či existujú globálne dáta.");
if (window.globalUserProfileData) {
    console.log("MyDataApp.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    renderApp(window.globalUserProfileData);
} else {
    // Ak dáta nie sú k dispozícii, vykreslíme komponent s null, ktorý zobrazí loader
    console.log("MyDataApp.js: Globálne dáta ešte neexistujú. Vykresľujem loader a čakám na udalosť.");
    renderApp(null);
}

// Upratovanie listenera, ak by sa načítač zopakoval
window.addEventListener('beforeunload', () => {
    window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
});

// Explicitne sprístupníme hlavnú komponentu pre globálne použitie, ak je to potrebné
window.MyDataApp = MyDataApp;
