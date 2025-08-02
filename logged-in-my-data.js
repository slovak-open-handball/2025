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
    } else { // 'info' alebo iné
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};

// Vytvorenie React komponentu pre hlavnú aplikáciu
const MyDataApp = ({ userProfileData, roleColor }) => {
    const [showModal, setShowModal] = useState(false);

    // Načítanie globálnych dát pri prvom renderovaní
    useEffect(() => {
        console.log("MyDataApp.js: Komponent MyDataApp bol inicializovaný.");
        // Ak chceme na začiatku zobraziť notifikáciu, môžeme ju volať tu.
    }, []);

    // Loader, kým sa dáta nenachítajú
    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    // Funkcia na otvorenie modálneho okna pre úpravu profilu
    const openEditProfileModal = () => {
        console.log("MyDataApp.js: Otváram modálne okno pre úpravu profilu.");
        setShowModal(true);
    };

    const formatPhoneNumber = (dialCode, number) => {
        if (!dialCode || !number) return 'Nezadané';

        // Odstránenie všetkých nečíslic z čísla, okrem znaku +
        const cleanedNumber = number.replace(/[^\d+]/g, '');

        // Predvolený formát pre telefónne čísla (napr. 09XX XXX XXX)
        // Predpokladáme, že dialCode už má na začiatku '+'
        return `${dialCode} ${cleanedNumber.substring(0, 3)} ${cleanedNumber.substring(3, 6)} ${cleanedNumber.substring(6)}`;
    };

    const getRoleName = (role) => {
        switch (role) {
            case 'admin':
                return 'Administrátor';
            case 'editor':
                return 'Editor';
            case 'user':
                return 'Používateľ';
            default:
                return 'Nezadané';
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin':
                return '#EF4444'; // červená
            case 'editor':
                return '#F59E0B'; // oranžová
            default: // user
                return '#10B981'; // zelená
        }
    };

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12' },
        React.createElement(
            'div',
            {
                className: 'bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center space-y-8 md:space-y-0 md:space-x-8'
            },
            React.createElement(
                'div',
                { className: 'flex-shrink-0 w-full md:w-1/3 flex flex-col items-center text-center' },
                React.createElement(
                    'div',
                    {
                        className: 'w-40 h-40 rounded-full flex items-center justify-center text-white text-6xl font-bold mb-4',
                        style: { backgroundColor: roleColor }
                    },
                    (userProfileData.name ? userProfileData.name[0] : 'U')
                ),
                React.createElement(
                    'h1',
                    { className: 'text-3xl sm:text-4xl font-bold text-gray-900 mb-2' },
                    userProfileData.name || 'Nezadané'
                ),
                React.createElement(
                    'p',
                    {
                        className: 'text-sm font-semibold uppercase tracking-wide px-3 py-1 rounded-full',
                        style: { backgroundColor: roleColor, color: 'white' }
                    },
                    getRoleName(userProfileData.role)
                )
            ),
            React.createElement(
                'div',
                { className: 'flex-grow w-full md:w-2/3 space-y-6 text-gray-700' },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-center mb-6' },
                    React.createElement(
                        'h2',
                        { className: 'text-2xl font-bold text-gray-900' },
                        'Informácie o profile'
                    ),
                    // Tlačidlo s ikonkou ceruzky a zmeneným textom
                    React.createElement(
                        'button',
                        {
                            onClick: openEditProfileModal,
                            className: 'flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg shadow-sm transition-colors duration-200'
                        },
                        // SVG ikonka ceruzky
                        React.createElement(
                            'svg',
                            {
                                className: 'h-4 w-4 mr-2 text-white',
                                fill: 'none',
                                viewBox: '0 0 24 24',
                                stroke: 'currentColor'
                            },
                            React.createElement('path', {
                                strokeLinecap: 'round',
                                strokeLinejoin: 'round',
                                strokeWidth: '2',
                                d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z'
                            })
                        ),
                        'Upraviť údaje'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 sm:grid-cols-2 gap-6' },
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Priezvisko:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            userProfileData.surname || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Kontaktné telefónne číslo:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            formatPhoneNumber(userProfileData.dialCode, userProfileData.phoneNumber)
                        )
                    ),
                    React.createElement(
                        'div',
                        null,
                        React.createElement(
                            'p',
                            { className: 'font-bold text-gray-800 flex items-center' },
                            'Mesto:'
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-gray-800 text-lg mt-1' },
                            userProfileData.city || 'Nezadané'
                        )
                    ),
                    React.createElement(
                        'div',
                        null,
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
            roleColor: roleColor
        })
    );
};

// Renderovanie aplikácie do DOM, ktoré počká na dáta
window.addEventListener('globalDataUpdated', (event) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: event.detail, roleColor: event.detail?.roleColor || '#10b981' }));
        console.log("MyDataApp.js: Aplikácia vykreslená po načítaní dát.");
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
});

// Zabezpečenie, že ak sú dáta už načítané, aplikácia sa vykreslí
if (window.globalUserProfileData) {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: window.globalUserProfileData, roleColor: window.globalUserProfileData?.roleColor || '#10b981' }));
        console.log("MyDataApp.js: Aplikácia vykreslená s existujúcimi globálnymi dátami.");
    }
}

// Explicitne sprístupníme komponent pre ladenie alebo externé použitie
window.MyDataApp = MyDataApp;
