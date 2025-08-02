// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
    } else { // 'info' alebo iné
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    // Animácia fade-in
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 100);

    // Animácia fade-out po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};


/**
 * Hlavný React komponent pre stránku "Moja zóna".
 * Načíta profilové dáta používateľa z globálneho objektu a zobrazí ich.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(window.globalUserProfileData);
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(!window.globalUserProfileData);

    // Získanie farby role
    const roleColor = userProfileData?.role === 'admin' ? '#ef4444' : '#3b82f6';

    // Efekt na načítanie dát a nastavenie poslucháča
    useEffect(() => {
        const handleDataUpdate = (event) => {
            const data = event.detail;
            console.log("MyDataApp: Prijatá udalosť 'globalDataUpdated'. Aktualizujem stav.");
            setUserProfileData(data);
            setIsLoading(false);
        };

        // Skontrolujeme, či už sú dáta dostupné
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setIsLoading(false);
        }

        // Pridáme poslucháča na udalosť
        window.addEventListener('globalDataUpdated', handleDataUpdate);

        // Cleanup funkcia pre odstránenie poslucháča
        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    // Zobrazenie načítavacej animácie, kým sa dáta neuložia
    if (isLoading || !userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
            )
        );
    }

    return React.createElement(
        'div',
        { className: 'bg-white rounded-2xl shadow-2xl p-6 md:p-10 transition-all duration-300 transform hover:scale-[1.01]' },
        // Hlavička a tlačidlo úpravy
        React.createElement(
            'div',
            { className: 'flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-gray-200' },
            React.createElement(
                'h2',
                { className: 'text-3xl font-bold text-gray-800' },
                'Môj profil'
            ),
            React.createElement(
                'button',
                {
                    onClick: () => setShowModal(true),
                    className: 'mt-4 sm:mt-0 flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold shadow-md hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
                    style: { backgroundColor: roleColor }
                },
                React.createElement(
                    'svg',
                    { className: 'h-5 w-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                'Upraviť profil'
            )
        ),
        // Detaily profilu
        React.createElement(
            'div',
            { className: 'mt-8 grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12' },
            // Meno
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Meno:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.firstName || 'Nezadané'
                )
            ),
            // Priezvisko
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Priezvisko:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.lastName || 'Nezadané'
                )
            ),
            // Role
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
                    { className: `text-lg mt-1 font-semibold`, style: { color: roleColor } },
                    userProfileData.role === 'admin' ? 'Organizátor' : 'Účastník'
                )
            ),
            // Telefónne číslo
            userProfileData.role !== 'admin' && React.createElement(
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
                    userProfileData.phoneNumber || 'Nezadané'
                )
            ),
            // E-mailová adresa
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'E-mailová adresa kontaktnej osoby:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.email || 'Nezadané'
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

// Renderovanie aplikácie do DOM
const rootElement = document.getElementById('root');
if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
    const root = ReactDOM.createRoot(rootElement);
    root.render(React.createElement(MyDataApp, null));
    console.log("MyDataApp.js: Aplikácia vykreslená.");
} else {
    console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
