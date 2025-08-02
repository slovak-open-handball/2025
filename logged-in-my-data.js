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
    } else {
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-100 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-500 ${bgColorClass} ${textColorClass}`;
    }, 5000);
};


/**
 * Hlavný komponent Moja zóna. Spravuje zobrazenie používateľských dát
 * a modálneho okna pre ich úpravu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [roleColor, setRoleColor] = useState('#64748B'); // Predvolená farba

    const fetchUserProfile = () => {
        // Použitie globálnych premenných, ktoré nastavil AuthManager
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
        } else {
            console.warn("MyDataApp.js: Globálne dáta používateľa nie sú dostupné, čakám na overenie...");
        }
    };

    useEffect(() => {
        // Pri inicializácii komponentu sa pokúsi načítať profil
        fetchUserProfile();

        // Nastavenie listenera na globálnu udalosť
        const handleGlobalDataUpdate = () => {
            fetchUserProfile();
        };

        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Upratovanie po komponente - odstránenie listenera
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []);

    // Definovanie farieb pre rôzne role
    useEffect(() => {
        if (userProfileData) {
            switch (userProfileData.role) {
                case 'admin':
                    setRoleColor('#47b3ff'); // Farba pre admina
                    break;
                case 'hall':
                    setRoleColor('#b06835'); // Farba pre halu
                    break;
                case 'user':
                    setRoleColor('#9333EA'); // Farba pre bežného používateľa
                    break;
                default:
                    setRoleColor('#64748B'); // Sivá (predvolená farba)
            }
        }
    }, [userProfileData]);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
            )
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'text-center text-gray-500 pt-16' },
            React.createElement('p', null, 'Dáta používateľa neboli nájdené. Prosím, prihláste sa.')
        );
    }

    const ProfileIcon = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            className: 'h-16 w-16 text-white',
            fill: 'none',
            viewBox: '0 0 24 24',
            stroke: 'currentColor'
        },
        React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: '2',
            d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
        })
    );

    const EditIcon = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            className: 'h-5 w-5',
            fill: 'none',
            viewBox: '0 0 24 24',
            stroke: 'currentColor'
        },
        React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: '2',
            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'
        })
    );

    return React.createElement(
        'div',
        { className: 'bg-white shadow-xl rounded-xl p-8 max-w-4xl mx-auto my-8 md:my-16' },
        // Hlavička s ikonou a menom
        React.createElement(
            'div',
            { className: 'flex items-center mb-8' },
            React.createElement(
                'div',
                {
                    className: 'flex-shrink-0 flex items-center justify-center h-20 w-20 rounded-full text-white',
                    style: { backgroundColor: roleColor }
                },
                ProfileIcon
            ),
            React.createElement(
                'div',
                { className: 'ml-6' },
                React.createElement(
                    'h1',
                    { className: 'text-4xl font-extrabold text-gray-900 leading-tight' },
                    `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || 'Nezadané'}`
                ),
            ),
            React.createElement(
                'button',
                {
                    onClick: () => setShowModal(true),
                    className: `ml-auto px-4 py-2 flex items-center space-x-2 text-sm font-medium rounded-full shadow-md transition-all duration-200 transform hover:scale-105 hover:shadow-lg focus:outline-none`,
                    style: { backgroundColor: roleColor, color: 'white' }
                },
                EditIcon,
                React.createElement('span', null, 'Upraviť profil')
            )
        ),
        // Sekcia s kontaktnými údajmi
        React.createElement(
            'div',
            { className: 'space-y-6' },
            React.createElement(
                'div',
                { className: 'border-l-4 pl-4', style: { borderColor: roleColor } },
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
            ),
            React.createElement(
                'div',
                { className: 'border-l-4 pl-4', style: { borderColor: roleColor } },
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Telefónne číslo kontaktnej osoby:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.phoneNumber || 'Nezadané'
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
