// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";

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
    } else {
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-100 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.innerText = message;

    setTimeout(() => {
        notificationElement.className = notificationElement.className.replace('opacity-100', 'opacity-0');
    }, 5000);
};

// Nová funkcia na určenie farby na základe roly
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff'; // Farba pre admina
        case 'hall':
            return '#b06835'; // Farba pre halu
        case 'user':
            return '#9333EA'; // Farba pre bežného používateľa
        default:
            return '#1D4ED8'; // Predvolená farba (bg-blue-800)
    }
};


const MyDataApp = ({ userProfileData, roleColor }) => {
    const [showModal, setShowModal] = useState(false);

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }
    
    // Pridanie premennej na zobrazenie emailu
    const userEmail = userProfileData.email || 'Nezadané';

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4 sm:px-6 lg:px-8' },
        React.createElement(
            'div',
            { className: 'max-w-4xl w-full bg-white shadow-xl rounded-2xl p-8' },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-6' },
                React.createElement(
                    'h2',
                    { className: 'text-3xl font-bold text-gray-900' },
                    `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: `px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2`,
                        style: { backgroundColor: roleColor, borderColor: roleColor }
                    },
                    'Upraviť profil'
                )
            ),
            // Zmena rozloženia na jeden stĺpec a odstránenie obdĺžnikov
            React.createElement(
                'div',
                { className: 'space-y-6' },
                // Sekcia s osobnými údajmi
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800' },
                        'Meno:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        userProfileData.firstName || 'Nezadané'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800' },
                        'Priezvisko:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        userProfileData.lastName || 'Nezadané'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800' },
                        'Telefónne číslo:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        userProfileData.phoneNumber || 'Nezadané'
                    )
                ),
                // Sekcia s kontaktnými údajmi
                React.createElement(
                    'div',
                    { className: 'mb-4' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'E-mailová adresa kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        userEmail
                    )
                )
            )
        ),
        // Na tomto mieste sa modálne okno zavolá a po úspešnom uložení zmien sa zobrazí notifikácia
        React.createElement(ChangeProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
            onSaveSuccess: () => {
                setShowModal(false);
                window.showGlobalNotification('Profilové údaje boli úspešne zmenené', 'success');
            },
            userProfileData: userProfileData,
            roleColor: roleColor
        })
    );
};

// Renderovanie aplikácie do DOM, ktoré počká na dáta
window.addEventListener('globalDataUpdated', (event) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const userRole = event.detail?.role;
        const roleColor = getRoleColor(userRole);
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: event.detail, roleColor: roleColor }));
        console.log("MyDataApp.js: Aplikácia vykreslená po načítaní dát.");
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
});

// Zabezpečenie, že ak sú dáta už načítané, aplikácia sa vykreslí
if (window.globalUserProfileData) {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const userRole = window.globalUserProfileData.role;
        const roleColor = getRoleColor(userRole);
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: window.globalUserProfileData, roleColor: roleColor }));
        console.log("MyDataApp.js: Aplikácia vykreslená s existujúcimi dátami.");
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
