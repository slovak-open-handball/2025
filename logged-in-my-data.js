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

    const billingInfoExists = localProfileData.companyName || localProfileData.street || localProfileData.ico;

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

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:pt-16' },
        React.createElement(
            'div',
            { className: 'flex flex-col lg:flex-row lg:space-x-8' },
            // Ľavý stĺpec pre osobné údaje
            React.createElement(
                'div',
                { className: 'w-full lg:w-1/2 p-6 bg-white rounded-xl shadow-xl' },
                React.createElement('h4', { className: 'text-2xl font-bold text-gray-900 mb-6' }, 'Moje údaje'),
                React.createElement(DataRow, { label: 'Meno a Priezvisko', value: localProfileData.displayName }),
                React.createElement(DataRow, { label: 'Email', value: localProfileData.email }),
                React.createElement(DataRow, { label: 'Telefónne číslo', value: `${localProfileData.dialCode} ${localProfileData.phoneNumber}` }),
                React.createElement(DataRow, { label: 'Rola', value: localProfileData.role }),
                React.createElement(DataRow, { label: 'Status', value: localProfileData.status })
            ),
            // Pravý stĺpec pre fakturačné údaje
            React.createElement(
                'div',
                { className: 'w-full lg:w-1/2 p-6 bg-white rounded-xl shadow-xl mt-8 lg:mt-0' },
                React.createElement('h4', { className: 'text-2xl font-bold text-gray-900 mb-6' }, 'Fakturačné údaje'),
                billingInfoExists ?
                [
                    React.createElement(DataRow, { key: 'companyName', label: 'Názov spoločnosti', value: localProfileData.companyName }),
                    React.createElement(DataRow, { key: 'address', label: 'Adresa', value: `${localProfileData.street} ${localProfileData.houseNumber}, ${localProfileData.city}, ${localProfileData.postalCode}` }),
                    React.createElement(DataRow, { key: 'country', label: 'Krajina', value: localProfileData.country }),
                    React.createElement(DataRow, { key: 'ico', label: 'IČO', value: localProfileData.ico }),
                    React.createElement(DataRow, { key: 'dic', label: 'DIČ', value: localProfileData.dic }),
                    React.createElement(DataRow, { key: 'icdph', label: 'IČ DPH', value: localProfileData.icdph }),
                ]
                :
                React.createElement('p', { className: 'text-lg text-gray-500' }, 'Fakturačné údaje neboli zadané.')
            )
        ),
        // Tlačidlá pre akcie
        React.createElement(
            'div',
            { className: 'mt-12 flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4' },
            React.createElement(
                'button',
                {
                    onClick: () => setShowChangeProfileModal(true),
                    className: `px-8 py-3 rounded-full font-bold text-lg text-white transition-all duration-300 hover:scale-105 focus:outline-none shadow-lg`,
                    style: { backgroundColor: roleColor }
                },
                'Upraviť profil'
            ),
            React.createElement(
                'button',
                {
                    onClick: () => setShowChangeBillingModal(true),
                    className: `px-8 py-3 rounded-full font-bold text-lg text-white transition-all duration-300 hover:scale-105 focus:outline-none shadow-lg`,
                    style: { backgroundColor: roleColor }
                },
                'Upraviť fakturačné údaje'
            )
        ),

        // Modálne okná
        React.createElement(ChangeProfileModal, { show: showChangeProfileModal, onClose: () => setShowChangeProfileModal(false), userProfileData: localProfileData, roleColor: roleColor }),
        React.createElement(ChangeBillingModal, { show: showChangeBillingModal, onClose: () => setShowChangeBillingModal(false), userProfileData: localProfileData, roleColor: roleColor })
    );
};

// Funkcia na obsluhu udalosti 'globalDataUpdated' a vykreslenie React komponentu
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
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500' })
            )
        );
    }
}
