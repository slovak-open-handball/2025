// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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
        textColorClass = 'text-green-800';
    } else if (type === 'error') {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    } else {
        bgColorClass = 'bg-blue-100';
        textColorClass = 'text-blue-800';
    }

    notificationElement.innerHTML = `<p class="font-semibold">${message}</p>`;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;

    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        notificationElement.style.opacity = '0';
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.parentNode.removeChild(notificationElement);
            }
        }, 300);
    }, 5000);
};

/**
 * Hlavný komponent, ktorý zobrazuje profil používateľa a obsluhuje načítanie dát
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);

    /**
     * Vráti hexadecimálnu farbu na základe roly používateľa.
     * Táto funkcia bola upravená, aby používala nové hexadecimálne hodnoty.
     */
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

    const headerColor = getRoleColor(userProfileData?.role);

    // Načítanie používateľských dát z globálnej premennej
    useEffect(() => {
        const handleDataUpdate = (e) => {
            const data = e.detail;
            if (data) {
                setUserProfileData(data);
            } else {
                setUserProfileData(null);
            }
            setLoading(false);
        };

        // Kontrola, či sú dáta už načítané pri štarte
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
        }

        window.addEventListener('globalDataUpdated', handleDataUpdate);

        return () => {
            window.removeEventListener('globalDataUpdated', handleDataUpdate);
        };
    }, []);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center min-h-screen' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center min-h-screen' },
            React.createElement('div', { className: 'text-gray-600 text-xl' }, 'Používateľ nie je prihlásený alebo dáta nie sú dostupné.')
        );
    }

    return React.createElement(
        'div',
        // Zmena farby pozadia z bg-gray-100 na bg-white
        { className: 'min-h-screen bg-white flex flex-col items-center py-8' },
        React.createElement(
            'div',
            { className: 'bg-white shadow-lg rounded-xl w-full max-w-2xl overflow-hidden' },
            React.createElement(
                'div',
                // Inline štýl pre farbu pozadia
                { style: { backgroundColor: headerColor }, className: `text-white px-6 py-4 flex justify-between items-center` },
                React.createElement('h1', { className: 'text-2xl font-bold' }, 'Moje údaje'),
                React.createElement(
                    'button',
                    // Pridanie onClick eventu na zobrazenie modálneho okna
                    { onClick: () => setShowModal(true), className: 'text-white hover:text-gray-200' },
                    // Použitie SVG ikony ceruzky namiesto triedy 'fa-solid fa-edit'
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z' })
                    )
                )
            ),
            React.createElement(
                'div',
                { className: 'p-6 space-y-4' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'Meno a priezvisko kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || ''}`
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800 flex items-center' },
                        'Telefónne číslo kontaktnej osoby:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        userProfileData.contactPhoneNumber || 'Nezadané'
                    )
                ),
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
