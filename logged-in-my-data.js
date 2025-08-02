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
        bgColorClass = 'bg-gray-100';
        textColorClass = 'text-gray-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.add('opacity-100');
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
    }, 5000);
};

/**
 * Funkcia na získanie farby na základe roly
 * @param {string} role - Rola používateľa
 * @returns {string} Hex kód farby
 */
const getRoleColor = (role) => {
    switch (role) {
        case 'organizator':
            return '#ef4444'; // červená
        case 'trener':
            return '#f97316'; // oranžová
        case 'rozhodca':
            return '#eab308'; // žltá
        case 'delegat':
            return '#22c55e'; // zelená
        case 'zdravotnik':
            return '#3b82f6'; // modrá
        default:
            return '#10b981'; // smaragdová (predvolená)
    }
};


/**
 * Komponent pre zobrazenie hlavnej stránky s profilom používateľa
 * @param {object} props - Vlastnosti komponentu
 * @param {object} props.userProfileData - Dáta profilu používateľa
 * @param {string} props.roleColor - Farba priradená k role používateľa
 */
const MyDataApp = ({ userProfileData, roleColor }) => {
    const [showModal, setShowModal] = useState(false);

    if (!userProfileData) {
        return (
            React.createElement('div', { className: 'flex justify-center pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }

    const {
        meno,
        priezvisko,
        rodneCislo,
        statnaPrislusnost,
        adresaUlica,
        adresaMesto,
        adresaPsc,
        telefonneCislo,
        email,
        role
    } = userProfileData;

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8' },
        React.createElement(
            'div',
            { className: 'max-w-4xl mx-auto' },
            React.createElement(
                'div',
                { className: 'flex flex-col md:flex-row md:items-center md:justify-between mb-8' },
                // ZMENENÝ TEXT NADPISU
                React.createElement(
                    'h1',
                    { className: 'text-3xl font-bold text-gray-900 leading-tight' },
                    'Moje údaje'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'mt-4 md:mt-0 px-6 py-2 text-sm font-semibold text-white rounded-full shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2',
                        style: { backgroundColor: roleColor }
                    },
                    'Upraviť profil'
                )
            ),
            React.createElement(
                'div',
                { className: 'bg-white shadow-xl rounded-2xl p-6 sm:p-8' },
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12' },
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Meno a priezvisko:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            `${meno || 'Nezadané'} ${priezvisko || ''}`
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Rola:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            role || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Rodné číslo:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            rodneCislo || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Štátna príslušnosť:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            statnaPrislusnost || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Adresa:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            `${adresaUlica || 'Nezadané'}, ${adresaMesto || 'Nezadané'}, ${adresaPsc || 'Nezadané'}`
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Telefónne číslo:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            telefonneCislo || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'flex flex-col md:col-span-2' },
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'E-mailová adresa kontaktnej osoby:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            email || 'Nezadané'
                        )
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
