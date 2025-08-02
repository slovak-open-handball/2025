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
        bgColorClass = 'bg-green-500';
        textColorClass = 'text-white';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-500';
        textColorClass = 'text-white';
    } else {
        bgColorClass = 'bg-blue-500';
        textColorClass = 'text-white';
    }

    // Odstránenie predchádzajúcich tried farieb a pridanie nových
    notificationElement.className = notificationElement.className.replace(/bg-\w+-\d+/g, '').replace(/text-\w+/, '');
    notificationElement.classList.add(bgColorClass, textColorClass);
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
 * Hlavný React komponent pre zobrazenie a úpravu profilu prihláseného používateľa.
 * @param {object} props - Vlastnosti komponentu.
 * @param {object} props.userProfileData - Dáta používateľského profilu.
 * @param {string} props.roleColor - Farba priradená role používateľa.
 */
const MyDataApp = ({ userProfileData, roleColor }) => {
    console.log("MyDataApp.js: Komponent MyDataApp sa vykresľuje s dátami:", userProfileData);
    // Inicializujeme stav s počiatočnými dátami.
    const [data, setData] = useState(userProfileData);
    const [isMyDataLoaded, setIsMyDataLoaded] = useState(!!userProfileData && Object.keys(userProfileData).length > 0);
    const [showModal, setShowModal] = useState(false);

    // Načítanie a spracovanie globálnych dát
    useEffect(() => {
        console.log("MyDataApp.js: useEffect spustený, kontrola dát.");
        if (userProfileData && Object.keys(userProfileData).length > 0) {
            console.log("MyDataApp.js: Dáta používateľa nájdené, aktualizujem stav.");
            setData(userProfileData);
            setIsMyDataLoaded(true);
        } else {
             console.log("MyDataApp.js: Dáta používateľa nie sú k dispozícii v počiatočnom stave.");
        }
    }, [userProfileData]);

    // Funkcia na overenie a zobrazenie dát
    const renderContent = () => {
        if (!isMyDataLoaded) {
            console.log("MyDataApp.js: Zobrazujem načítavaciu animáciu.");
            // Animácia načítania, ak dáta nie sú dostupné
            return React.createElement(
                'div',
                { className: 'flex justify-center pt-16' },
                React.createElement(
                    'div',
                    { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
                )
            );
        }

        console.log("MyDataApp.js: Zobrazujem obsah aplikácie.");
        // Zobrazenie obsahu
        return React.createElement(
            'div',
            { className: 'max-w-4xl mx-auto' },
            // Profilový box
            React.createElement(
                'div',
                { className: `bg-white rounded-xl shadow-xl p-8 md:p-12 mb-8` },
                React.createElement(
                    'div',
                    { className: 'flex justify-between items-start flex-wrap gap-4 mb-6' },
                    // Left side: Name, Role, Email
                    React.createElement(
                        'div',
                        { className: 'flex-1 min-w-0' },
                        React.createElement(
                            'h1',
                            { className: 'text-3xl md:text-4xl font-bold text-gray-900 truncate' },
                            data.role === 'user'
                                ? 'Údaje kontaktnej osoby'
                                : data.role === 'hall' || data.role === 'admin'
                                    ? 'Moje údaje'
                                    : `${data.firstName || ''} ${data.lastName || ''}`
                        ),
                        React.createElement(
                            'p',
                            { className: 'text-lg text-gray-600 mt-1' },
                            data.email || 'E-mail neznámy'
                        ),
                        React.createElement(
                            'span',
                            {
                                className: 'mt-3 inline-block px-4 py-1 text-sm font-semibold text-white rounded-full shadow-md',
                                style: { backgroundColor: roleColor }
                            },
                            data.role || 'Používateľ'
                        )
                    ),
                    // Right side: Edit button
                    React.createElement(
                        'button',
                        {
                            onClick: () => setShowModal(true),
                            className: `flex items-center space-x-2 px-6 py-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50`,
                            style: {
                                backgroundColor: roleColor,
                                color: 'white'
                            }
                        },
                        // Ikona ceruzky SVG
                        React.createElement(
                            'svg',
                            {
                                xmlns: "http://www.w3.org/2000/svg",
                                className: "h-5 w-5",
                                viewBox: "0 0 20 20",
                                fill: "currentColor",
                            },
                            React.createElement('path', { d: "M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" })
                        ),
                        'Upraviť profil'
                    )
                ),
                // Sekcia s kontaktnými údajmi
                React.createElement(
                    'div',
                    { className: 'mt-8 border-t border-gray-200 pt-8' },
                    React.createElement(
                        'h3',
                        { className: 'text-xl font-semibold text-gray-800 mb-4' },
                        'Kontaktné údaje'
                    ),
                    React.createElement(
                        'dl',
                        { className: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' },
                        // Telefónne číslo
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: 'text-sm font-medium text-gray-500' },
                                'Telefón'
                            ),
                            React.createElement(
                                'dd',
                                { className: 'mt-1 text-gray-900 font-semibold' },
                                data.phoneNumber ? `(${data.phoneDialCode}) ${data.phoneNumber}` : 'Nezadané'
                            )
                        ),
                        // Adresa
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: 'text-sm font-medium text-gray-500' },
                                'Adresa'
                            ),
                            React.createElement(
                                'dd',
                                { className: 'mt-1 text-gray-900 font-semibold' },
                                data.address || 'Nezadaná'
                            )
                        ),
                        // Mesto
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: 'text-sm font-medium text-gray-500' },
                                'Mesto'
                            ),
                            React.createElement(
                                'dd',
                                { className: 'mt-1 text-gray-900 font-semibold' },
                                data.city || 'Nezadané'
                            )
                        ),
                        // PSČ
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: 'text-sm font-medium text-gray-500' },
                                'PSČ'
                            ),
                            React.createElement(
                                'dd',
                                { className: 'mt-1 text-gray-900 font-semibold' },
                                data.zipCode || 'Nezadané'
                            )
                        ),
                        // Krajina
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: 'text-sm font-medium text-gray-500' },
                                'Krajina'
                            ),
                            React.createElement(
                                'dd',
                                { className: 'mt-1 text-gray-900 font-semibold' },
                                data.country || 'Nezadaná'
                            )
                        )
                    )
                )
            ),
            // Modálne okno pre úpravu profilu
            React.createElement(ChangeProfileModal, {
                show: showModal,
                onClose: () => setShowModal(false),
                userProfileData: data,
                roleColor: roleColor,
                onProfileUpdated: (newData) => {
                    setData(newData);
                    setShowModal(false);
                }
            })
        );
    };

    return renderContent();
};

// Pomocná funkcia na určenie farby podľa roly
const getRoleColor = (role) => {
    switch (role) {
        case 'organizator':
            return '#1D4ED8'; // Modrá
        case 'trener':
            return '#059669'; // Zelená
        case 'rozhodca':
            return '#DC2626'; // Červená
        case 'delegat':
            return '#CA8A04'; // Žltá
        case 'zdravotnik':
            return '#6D28D9'; // Fialová
        default:
            return '#4B5563'; // Šedá
    }
};

window.getRoleColor = getRoleColor;

// Funkcia na spracovanie udalosti 'globalDataUpdated' a vykreslenie aplikácie.
// Táto funkcia sa spustí len vtedy, keď authentication.js úspešne načíta dáta.
const handleDataUpdateAndRender = (event) => {
    console.log("MyDataApp.js: Spracúvam udalosť 'globalDataUpdated'.");
    // Okamžite skryjeme loader, akonáhle spracujeme udalosť.
    if (typeof window.hideGlobalLoader === 'function') {
        window.hideGlobalLoader();
        console.log("MyDataApp.js: Skrývam načítavaciu animáciu.");
    }
    
    const data = event.detail;
    if (data && Object.keys(data).length > 0) {
        console.log("MyDataApp.js: Dáta prijaté, vykresľujem aplikáciu.");
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
    console.log("MyDataApp.js: Globálne dáta ešte neexistujú. Čakám na udalosť 'globalDataUpdated'.");
}
