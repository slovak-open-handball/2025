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

// Ikonka pre používateľa ako React element
const UserIcon = (props) => React.createElement(
  'svg',
  {
    ...props,
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  React.createElement('path', { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }),
  React.createElement('circle', { cx: "12", cy: "7", r: "4" })
);

// Ikonka pre e-mail ako React element
const MailIcon = (props) => React.createElement(
  'svg',
  {
    ...props,
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  React.createElement('rect', { width: "20", height: "16", x: "2", y: "4", rx: "2" }),
  React.createElement('path', { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" })
);

// Ikonka pre telefón ako React element
const PhoneIcon = (props) => React.createElement(
  'svg',
  {
    ...props,
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  React.createElement('path', { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" })
);

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
    
    // Funkcia na formátovanie roly
    const formatRole = (role) => {
        if (!role) return 'Nezadané';
        return role.charAt(0).toUpperCase() + role.slice(1);
    };
    
    const profileIconSvg = React.createElement(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            className: 'h-24 w-24',
            fill: 'none',
            viewBox: '0 0 24 24',
            stroke: 'currentColor'
        },
        React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: '1.5',
            d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
        })
    );
    
    const editIconSvg = React.createElement(
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
        { className: 'bg-white shadow-lg shadow-gray-200 rounded-3xl p-8 max-w-4xl mx-auto my-8 md:my-16' },
        React.createElement(
            'div',
            { className: 'flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8' },
            React.createElement(
                'div',
                { className: 'flex flex-col items-center text-center w-full md:w-auto' },
                React.createElement(
                    'div',
                    {
                        className: 'flex-shrink-0 flex items-center justify-center h-40 w-40 rounded-full text-white mb-4 shadow-md',
                        style: { backgroundColor: roleColor }
                    },
                    profileIconSvg
                ),
                React.createElement(
                    'h2',
                    { className: 'text-2xl font-bold text-gray-900 leading-tight' },
                    `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-500 text-sm mt-1' },
                    'Registrácia: ' + new Date(userProfileData.createdAt?.toDate()).toLocaleDateString()
                )
            ),
            React.createElement(
                'div',
                { className: 'flex-1 w-full space-y-6 md:space-y-8 mt-6 md:mt-0' },
                React.createElement(
                    'h3',
                    { className: 'text-xl font-bold text-gray-800 border-b pb-2 mb-4' },
                    'Údaje'
                ),
                React.createElement(
                    'div',
                    { className: 'flex justify-end' },
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: `px-6 py-3 flex items-center space-x-2 text-sm font-medium rounded-full shadow-md transition-all duration-200 transform hover:scale-105 hover:shadow-lg focus:outline-none`,
                            style: { backgroundColor: roleColor, color: 'white' }
                        },
                        editIconSvg,
                        React.createElement('span', null, 'Upraviť profil')
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4 p-4 rounded-xl border border-gray-200' },
                    React.createElement(MailIcon, { className: 'h-6 w-6 text-gray-500' }),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-semibold text-gray-700' },
                            'E-mail'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-500' },
                            userProfileData.email || 'Nezadané'
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4 p-4 rounded-xl border border-gray-200' },
                    React.createElement(PhoneIcon, { className: 'h-6 w-6 text-gray-500' }),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-semibold text-gray-700' },
                            'Telefónne číslo'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-500' },
                            userProfileData.phoneNumber || 'Nezadané'
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex items-center space-x-4 p-4 rounded-xl border border-gray-200' },
                    React.createElement(UserIcon, { className: 'h-6 w-6 text-gray-500' }),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-semibold text-gray-700' },
                            'Rola'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-500' },
                            formatRole(userProfileData.role)
                        )
                    )
                )
            )
        ),
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
