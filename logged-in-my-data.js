// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
        textColorClass = 'text-green-700';
    } else {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-700';
    }

    notificationElement.className = `${bgColorClass} ${textColorClass} fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] transition-all duration-300 transform opacity-100 scale-100`;
    notificationElement.textContent = message;

    // Po 5 sekundách notifikáciu skryjeme
    setTimeout(() => {
        notificationElement.className = `${bgColorClass} ${textColorClass} fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] transition-all duration-300 transform opacity-0 scale-95`;
    }, 5000);
};

// Komponent, ktorý zabezpečí, že sa zobrazí len ak sú dáta pripravené
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [headerColor, setHeaderColor] = useState('bg-blue-600');
    const [showModal, setShowModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            setUserProfileData(data);
            setIsLoading(false);
            if (data && data.role === 'admin') {
                setHeaderColor('bg-red-600');
            } else {
                setHeaderColor('bg-blue-600');
            }
        };

        // Pridanie poslucháča udalostí
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Pri odmontovaní komponentu poslucháč odstránime
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Loader
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

    // Funkcia na formátovanie telefónneho čísla
    const formatPhoneNumber = (phoneNumber) => {
        if (!phoneNumber) return 'Nezadané';
        const dialCode = countryDialCodes.find(c => phoneNumber.startsWith(c.dialCode));
        if (dialCode) {
            const numberPart = phoneNumber.substring(dialCode.dialCode.length);
            return `${dialCode.dialCode} ${numberPart.replace(/(\d{3})(?=\d)/g, '$1 ')}`;
        }
        return phoneNumber;
    };

    const formattedPhoneNumber = formatPhoneNumber(userProfileData.contactPhoneNumber);

    return React.createElement(
        'div',
        { className: 'flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4 sm:p-6 lg:p-8 bg-gray-50' },
        React.createElement(
            'div',
            { className: `w-full max-w-2xl bg-white rounded-xl shadow-lg border-t-8 ${headerColor} transition-all duration-300 overflow-hidden` },
            // Hlavička s informáciami o profile a tlačidlom na úpravu
            React.createElement(
                'div',
                { className: 'p-6 sm:p-8 flex items-center justify-between' },
                React.createElement(
                    'div',
                    { className: 'flex items-center' },
                    React.createElement(
                        'svg',
                        { className: 'h-12 w-12 text-white', fill: 'currentColor', viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
                        React.createElement('path', { d: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' })
                    ),
                    React.createElement(
                        'div',
                        { className: 'ml-4' },
                        React.createElement('h2', { className: 'text-2xl font-bold text-white' }, `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || 'Nezadané'}`),
                        React.createElement('p', { className: 'text-sm font-medium text-white text-opacity-80' }, userProfileData.role === 'admin' ? 'Administrátor' : 'Používateľ')
                    )
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'px-4 py-2 bg-white text-gray-800 rounded-lg shadow font-medium hover:bg-gray-100 transition-colors duration-200'
                    },
                    'Upraviť'
                )
            ),

            // Telo s detailami profilu
            React.createElement(
                'div',
                { className: 'p-6 sm:p-8 bg-white' },
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12' },
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
                            formattedPhoneNumber
                        )
                    ),
                    // Email
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
            roleColor: headerColor
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
