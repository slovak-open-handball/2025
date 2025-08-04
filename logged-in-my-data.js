// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc, addDoc, collection, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

const { useState, useEffect, useRef } = React;

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

    // Nastavenie farby a textu notifikácie na základe typu
    switch (type) {
        case 'success':
            notificationElement.style.backgroundColor = '#4CAF50';
            notificationElement.style.color = 'white';
            break;
        case 'error':
            notificationElement.style.backgroundColor = '#F44336';
            notificationElement.style.color = 'white';
            break;
        case 'info':
        default:
            notificationElement.style.backgroundColor = '#2196F3';
            notificationElement.style.color = 'white';
            break;
    }
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    notificationElement.classList.remove('opacity-0');
    notificationElement.classList.add('opacity-100');

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0');
    }, 5000);
};

/**
 * Hlavný komponent React aplikácie.
 */
const MyDataApp = ({ userProfileData, userId }) => {
    const db = window.db;
    const auth = window.auth;

    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [billingModalVisible, setBillingModalVisible] = useState(false);

    // Listener pre menu, ktorý spúšťa zmenu okraja a šírky obsahu pri zmenách šírky menu
    useEffect(() => {
        const leftMenu = document.getElementById('left-menu');
        const mainContent = document.getElementById('main-content-area');
    
        if (leftMenu && mainContent) {
            // Funkcia na aktualizáciu obsahu na základe šírky menu
            const updateContentPosition = () => {
                const menuWidth = leftMenu.offsetWidth;
                mainContent.style.marginLeft = `${menuWidth}px`;
                mainContent.style.width = `calc(100% - ${menuWidth}px)`;
            };

            // Vytvorenie MutationObserver
            // Bude sledovať zmeny v štýloch a atribútoch menu, aby sa dynamicky prispôsoboval obsah
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
                        updateContentPosition();
                    }
                });
            });

            // Spustenie pozorovateľa na ľavom menu
            observer.observe(leftMenu, {
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            // Počiatočné nastavenie pozície
            updateContentPosition();
    
            // Cleanup funkcia pre odpojenie pozorovateľa
            return () => {
                observer.disconnect();
            };
        }
    }, []);

    if (!userProfileData) {
        return React.createElement('div', { className: 'flex justify-center items-center h-full pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }
    
    // UI pre používateľov
    const userUI = React.createElement('div', { className: 'bg-white rounded-xl shadow-xl p-8' },
        React.createElement('div', { className: 'flex justify-between items-center mb-6' },
            React.createElement('h2', { className: 'text-3xl font-bold text-gray-800' }, 'Môj Profil'),
            React.createElement('button', {
                onClick: () => setProfileModalVisible(true),
                className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105'
            }, 'Upraviť')
        ),
        React.createElement('div', { className: 'space-y-4' },
            // Zobrazovanie profilových údajov
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Meno:'),
                React.createElement('span', null, userProfileData.name)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Priezvisko:'),
                React.createElement('span', null, userProfileData.surname)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'E-mail:'),
                React.createElement('span', null, userProfileData.email)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Telefón:'),
                React.createElement('span', null, userProfileData.dialCode + ' ' + userProfileData.phone)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Rola:'),
                React.createElement('span', null, userProfileData.role)
            ),
            React.createElement('div', { className: 'flex justify-between items-center mt-8' },
                React.createElement('h3', { className: 'text-2xl font-bold text-gray-800' }, 'Fakturačné údaje'),
                React.createElement('button', {
                    onClick: () => setBillingModalVisible(true),
                    className: 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition-all duration-300 transform hover:scale-105'
                }, 'Upraviť')
            )
        ),
        // Fakturačné údaje
        React.createElement('div', { className: 'mt-6 space-y-4' },
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Názov klubu:'),
                React.createElement('span', null, userProfileData.clubName)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Ulica a číslo:'),
                React.createElement('span', null, `${userProfileData.street} ${userProfileData.houseNumber}`)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Mesto:'),
                React.createElement('span', null, userProfileData.city)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'PSČ:'),
                React.createElement('span', null, userProfileData.postalCode)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'Krajina:'),
                React.createElement('span', null, userProfileData.country)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'IČO:'),
                React.createElement('span', null, userProfileData.ico)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'DIČ:'),
                React.createElement('span', null, userProfileData.dic)
            ),
            React.createElement('div', { className: 'flex items-center' },
                React.createElement('strong', { className: 'w-40 text-gray-600' }, 'IČ DPH:'),
                React.createElement('span', null, userProfileData.icdph)
            )
        )
    );

    return React.createElement(
        'div',
        { className: 'min-h-screen' },
        userUI,
        React.createElement(ChangeProfileModal, { show: profileModalVisible, onClose: () => setProfileModalVisible(false), userProfileData: userProfileData, roleColor: userProfileData?.roleColor || '#5a67d8' }),
        React.createElement(ChangeBillingModal, { show: billingModalVisible, onClose: () => setBillingModalVisible(false), userProfileData: userProfileData, roleColor: userProfileData?.roleColor || '#5a67d8' })
    );
};


// Funkcia pre vykreslenie React aplikácie
const renderMyDataApp = (userProfileData) => {
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: userProfileData, userId: userProfileData.id }));
        console.log("MyDataApp.js: Aplikácia bola úspešne vykreslená na základe udalosti 'globalDataUpdated'.");
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
};

// Funkcia na obsluhu udalosti a vykreslenie
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    if (userProfileData) {
        renderMyDataApp(userProfileData);
    } else {
        // Ak dáta nie sú dostupné, zobrazíme loader
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
        } else {
            console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        }
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
    } else {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
    }
}
