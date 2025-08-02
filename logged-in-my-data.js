// Importy pre Firebase funkcie
// Tento súbor už nepotrebuje inicializovať Firebase, pretože sa spolieha na `authentication.js`
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
    notificationElement.innerText = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.remove('opacity-0');
        notificationElement.classList.add('opacity-100');
    }, 100);

    // Skrytie notifikácie po 3 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0');
    }, 3000);
};

// Hlavný komponent aplikácie
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Funkcia na spracovanie globálnej udalosti
        const handleGlobalDataUpdate = (event) => {
            const data = event.detail;
            if (data) {
                console.log("MyDataApp.js: Globálne údaje používateľa aktualizované.", data);
                setUserProfileData(data);
                setLoading(false);
            } else {
                // Používateľ nie je prihlásený alebo dáta neboli nájdené
                console.log("MyDataApp.js: Žiadne údaje používateľa k dispozícii.");
                setUserProfileData(null);
                setLoading(false);
                setError(null);
            }
        };

        // Pridanie listenera na globálnu udalosť
        window.addEventListener('globalDataUpdated', handleGlobalDataUpdate);

        // Kontrola, či už sú dáta dostupné pri prvom načítaní
        if (window.globalUserProfileData) {
            setUserProfileData(window.globalUserProfileData);
            setLoading(false);
        } else if (window.isGlobalAuthReady) {
            // Ak je auth ready, ale dáta nie, znamená to, že používateľ nie je prihlásený alebo dáta chýbajú
            setLoading(false);
            setUserProfileData(null);
        }

        // Cleanup funkcia na odstránenie listenera
        return () => {
            window.removeEventListener('globalDataUpdated', handleGlobalDataUpdate);
        };
    }, []); // Prázdne pole závislostí zaručuje, že sa vykoná len raz

    // Vytvorenie farby role
    const roleColor = userProfileData?.role === 'admin' ? '#ef4444' : '#3b82f6';
    const roleBgColor = userProfileData?.role === 'admin' ? 'bg-red-500' : 'bg-blue-500';

    // Stav načítavania
    if (loading) {
        return (
            React.createElement('div', { className: 'flex justify-center pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }

    // Stav chyby alebo neprihláseného používateľa
    if (error || !userProfileData) {
        return React.createElement('div', { className: 'text-center text-gray-500 mt-16' },
            React.createElement('p', null, error || 'Nie ste prihlásený, alebo vaše údaje nie sú dostupné.'),
            React.createElement('p', null, 'Skúste sa prosím prihlásiť.')
        );
    }

    // Helper funkcia pre formátovanie telefónneho čísla
    const formatPhoneNumber = (fullPhoneNumber) => {
        if (!fullPhoneNumber) {
            return 'Nezadané';
        }
        const foundCode = countryDialCodes.find(c => fullPhoneNumber.startsWith(c.dialCode));
        if (foundCode) {
            const phoneNumberWithoutCode = fullPhoneNumber.substring(foundCode.dialCode.length);
            return `${foundCode.dialCode} ${phoneNumberWithoutCode.trim()}`;
        }
        return fullPhoneNumber;
    };

    // Hlavné používateľské rozhranie
    return (
        React.createElement('div', { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16' },
            // Nadpis a tlačidlo
            React.createElement('div', { className: 'flex justify-between items-center mb-8' },
                React.createElement('h1', { className: 'text-4xl font-bold text-gray-800' }, 'Moje údaje'),
                userProfileData?.role !== 'admin' &&
                React.createElement('button', {
                    onClick: () => setShowModal(true),
                    className: `flex items-center px-6 py-3 rounded-full text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${roleBgColor}`,
                    style: { backgroundColor: roleColor }
                },
                    React.createElement('svg', {
                        className: 'w-5 h-5 mr-2',
                        fill: 'none',
                        stroke: 'currentColor',
                        viewBox: '0 0 24 24',
                        xmlns: 'http://www.w3.org/2000/svg'
                    },
                        React.createElement('path', {
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            strokeWidth: '2',
                            d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L15.232 5.232z'
                        })
                    ),
                    'Upraviť'
                )
            ),

            // Informačná karta
            React.createElement('div', { className: 'bg-white rounded-xl shadow-lg p-6 md:p-8' },
                // Rozloženie s dvoma stĺpcami pre telefón a meno
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-y-0 md:gap-x-12 pb-4 border-b border-gray-200' },
                    // Riadok s menom a priezviskom
                    React.createElement('div', { className: 'flex-1' },
                        React.createElement('p', { className: 'font-bold text-gray-800' }, 'Meno a Priezvisko:'),
                        React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim())
                    ),
                    // Riadok s telefónnym číslom (iba pre bežných používateľov)
                    userProfileData?.role !== 'admin' &&
                    React.createElement('div', { className: 'flex-1' },
                        React.createElement('p', { className: 'font-bold text-gray-800' }, 'Telefónne číslo:'),
                        React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, formatPhoneNumber(userProfileData.phoneNumber))
                    )
                ),

                // Samostatný riadok pre e-mail
                React.createElement('div', { className: 'mt-4 md:mt-6' },
                    React.createElement('p', { className: 'font-bold text-gray-800 flex items-center' }, 'E-mailová adresa kontaktnej osoby:'),
                    React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, userProfileData.email || 'Nezadané')
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
        )
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
