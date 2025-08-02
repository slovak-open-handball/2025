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
        textColorClass = 'text-green-700';
    } else {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-700';
    }

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] transition-opacity duration-300 opacity-100 ${bgColorClass} ${textColorClass}`;
    notificationElement.textContent = message;

    setTimeout(() => {
        notificationElement.className = notificationElement.className.replace('opacity-100', 'opacity-0');
    }, 5000);
};

const MyDataApp = ({ userProfileData: initialData, roleColor: initialColor }) => {
    const [userProfileData, setUserProfileData] = useState(initialData);
    const [loading, setLoading] = useState(false);
    const [roleColor, setRoleColor] = useState(initialColor);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        const handleGlobalDataUpdated = (event) => {
            const data = event.detail;
            setUserProfileData(data);
            if (data && data.roleColor) {
                setRoleColor(data.roleColor);
            }
            setLoading(false);
        };
        
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdated);
        setLoading(window.globalUserProfileData === null);

        // Ak uz su data dostupne pri starte, pouzivame ich
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            if (window.globalUserProfileData.roleColor) {
                setRoleColor(window.globalUserProfileData.roleColor);
            }
            setLoading(false);
        }
        
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdated);
        };
    }, []);

    const handleEditClick = () => {
        setShowModal(true);
    };

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'text-center text-lg text-gray-500 mt-16' },
            'Dáta profilu neboli nájdené. Skúste sa prosím znova prihlásiť.'
        );
    }
    
    // Extrahovanie telefónneho čísla bez predvoľby pre zobrazenie
    const phoneNumberWithoutDialCode = (userProfileData.phoneNumber || '').startsWith(userProfileData.dialCode)
        ? (userProfileData.phoneNumber || '').substring(userProfileData.dialCode.length)
        : userProfileData.phoneNumber;

    return React.createElement(
        'div',
        { className: 'bg-white rounded-xl shadow-2xl p-8 max-w-4xl mx-auto my-8', style: { borderColor: roleColor, borderLeftWidth: '4px' } },
        
        // Sekcia hlavičky a profilu
        React.createElement(
            'div',
            { className: 'flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-gray-200 mb-6' },
            React.createElement(
                'div',
                { className: 'flex items-center w-full md:w-auto' },
                // Kruh pre profilovú fotku
                React.createElement('div', {
                    className: 'w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-xl text-gray-600 font-bold mr-4',
                    style: { backgroundColor: roleColor + '20', color: roleColor }
                }, userProfileData.firstName ? userProfileData.firstName[0] : '?'),
                React.createElement(
                    'div',
                    null,
                    React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, `${userProfileData.firstName || 'Meno'} ${userProfileData.lastName || 'Priezvisko'}`),
                    React.createElement('span', { className: 'text-lg font-medium', style: { color: roleColor } }, userProfileData.role || 'Používateľ')
                )
            ),
            React.createElement(
                'button',
                {
                    onClick: handleEditClick,
                    className: 'mt-4 md:mt-0 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',
                    style: {
                        backgroundColor: 'white',
                        color: roleColor,
                        border: `2px solid ${roleColor}`,
                    }
                },
                'Upraviť'
            )
        ),

        // Sekcia kontaktných údajov
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12' },
            // Email
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'E-mailová adresa:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.email || 'Nezadané'
                )
            ),
            // Telefónne číslo
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Telefónne číslo:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.phoneNumber ? `${userProfileData.dialCode} ${phoneNumberWithoutDialCode}` : 'Nezadané'
                )
            ),
            // Adresa (placeholder)
            React.createElement(
                'div',
                null,
                React.createElement(
                    'p',
                    { className: 'font-bold text-gray-800 flex items-center' },
                    'Adresa:'
                ),
                React.createElement(
                    'p',
                    { className: 'text-gray-800 text-lg mt-1' },
                    userProfileData.address || 'Nezadaná'
                )
            )
        ),

        // Modálne okno
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
        console.log("MyDataApp.js: Aplikácia vykreslená pri štarte.");
    }
}
