// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

const { useState, useEffect } = React;

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

    // Komponent pre zobrazenie jedného riadku údajov
    const DataRow = ({ label, value }) => {
        const displayValue = value || 'Nezadané';
        const valueColorClass = value ? 'text-gray-800' : 'text-gray-400';
        return React.createElement(
            'div',
            { className: 'mb-4' },
            React.createElement('p', { className: 'text-sm font-medium text-gray-500' }, label),
            React.createElement('p', { className: `text-lg font-semibold ${valueColorClass}` }, displayValue)
        );
    };
    
    // Upravená ikona ceruzky bez spodného štvorca
    const PencilIcon = () => (
        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", className: "w-4 h-4 mr-2" },
            React.createElement("path", { d: "M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" })
        )
    );
    

    return React.createElement(
        'div',
        null,
        // Sekcia s hlavnými údajmi o profile
        React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-md overflow-hidden p-6 mb-6' },
            React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-4' },
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Môj profil'),
                // Tlačidlo na úpravu profilu
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowChangeProfileModal(true),
                        className: 'flex items-center text-sm font-semibold text-white px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 shadow-md',
                        style: { backgroundColor: roleColor }
                    },
                    React.createElement(PencilIcon),
                    'Upraviť'
                )
            ),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement(DataRow, { label: 'Meno a priezvisko', value: localProfileData.full_name }),
                React.createElement(DataRow, { label: 'Rola', value: localProfileData.role }),
                React.createElement(DataRow, { label: 'E-mail', value: localProfileData.email }),
                // Podmienka na zobrazenie telefónneho čísla
                localProfileData.role !== 'admin' && localProfileData.role !== 'hall' && React.createElement(DataRow, { label: 'Telefónne číslo', value: localProfileData.phone })
            )
        ),
        
        // Podmienka na zobrazenie sekcie s fakturačnými údajmi
        !hideBillingSection && React.createElement(
            'div',
            { className: 'bg-white rounded-xl shadow-md overflow-hidden p-6' },
            React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-4' },
                React.createElement('h2', { className: 'text-2xl font-bold text-gray-800' }, 'Fakturačné údaje'),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowChangeBillingModal(true),
                        className: 'flex items-center text-sm font-semibold text-white px-4 py-2 rounded-full transition-all duration-300 hover:scale-105 shadow-md',
                        style: { backgroundColor: roleColor }
                    },
                    React.createElement(PencilIcon),
                    'Upraviť'
                )
            ),
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement(DataRow, { label: 'Názov klubu', value: localProfileData.billing?.clubName }),
                React.createElement(DataRow, { label: 'Ulica', value: localProfileData.street }),
                React.createElement(DataRow, { label: 'Číslo domu', value: localProfileData.houseNumber }),
                React.createElement(DataRow, { label: 'Mesto', value: localProfileData.city }),
                React.createElement(DataRow, { label: 'PSČ', value: localProfileData.postalCode }),
                React.createElement(DataRow, { label: 'Krajina', value: localProfileData.country }),
                React.createElement(DataRow, { label: 'IČO', value: localProfileData.billing?.ico }),
                React.createElement(DataRow, { label: 'DIČ', value: localProfileData.billing?.dic }),
                React.createElement(DataRow, { label: 'IČ DPH', value: localProfileData.billing?.icdph })
            )
        ),
        
        // Modálne okno pre zmenu profilu
        React.createElement(ChangeProfileModal, {
            show: showChangeProfileModal,
            onClose: () => setShowChangeProfileModal(false),
            userProfileData: localProfileData,
            roleColor: roleColor
        }),
        
        // Modálne okno pre zmenu fakturačných údajov
        React.createElement(ChangeBillingModal, {
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
