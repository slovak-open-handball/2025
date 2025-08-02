// Importy pre Firebase funkcie
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";

const { useState, useEffect } = React;

/**
 * Globálna funkcia pre zobrazenie notifikácií
 * Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
 */
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');

    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a animácie
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300';
        document.body.appendChild(notificationElement);
    }

    // Určíme farby na základe typu správy
    let bgColorClass, textColorClass;
    if (type === 'success') {
        bgColorClass = 'bg-green-100';
        textColorClass = 'text-green-800';
    } else {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    }

    // Aktualizujeme obsah a štýl notifikácie
    notificationElement.innerHTML = `<p class="font-medium">${message}</p>`;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] transition-all duration-300 ${bgColorClass} ${textColorClass} opacity-100`;

    // Skryjeme notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.className = notificationElement.className.replace('opacity-100', 'opacity-0');
    }, 5000);
};

const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [headerColor, setHeaderColor] = useState('#1e90ff'); // Predvolená farba

    const userRoles = {
        'atlet': '#00BFFF', // DeepSkyBlue
        'trener': '#32CD32', // LimeGreen
        'rozhodca': '#FFA500', // Orange
        'organizator': '#FF4500', // OrangeRed
        'admin': '#8A2BE2' // BlueViolet
    };

    useEffect(() => {
        const auth = getAuth();
        const db = getFirestore();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    setUserProfileData(data);

                    // Nastavenie farby hlavičky na základe roly
                    const role = data.role || 'default';
                    setHeaderColor(userRoles[role] || '#1e90ff');
                } else {
                    console.error("User profile data not found.");
                    setUserProfileData(null);
                }
            } else {
                setUserProfileData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement(
                'div',
                { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' }
            )
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'text-center text-gray-500 mt-16' },
            'Používateľské dáta neboli nájdené.'
        );
    }

    // Formátovanie telefónneho čísla
    const formatPhoneNumber = (phoneNumber) => {
        if (!phoneNumber) return 'Nezadané';

        // Najprv skúsime nájsť predvoľbu
        let foundDialCode = countryDialCodes.find(c => phoneNumber.startsWith(c.dialCode));
        let formattedNumber = phoneNumber;

        if (foundDialCode) {
            // Ak sa predvoľba nájde, oddelíme ju od zvyšku čísla
            let remainingNumber = phoneNumber.substring(foundDialCode.dialCode.length);
            // Vytvoríme formát s medzerami, ak je to možné
            remainingNumber = remainingNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
            formattedNumber = `${foundDialCode.dialCode} ${remainingNumber}`;
        } else {
            // Ak sa predvoľba nenájde, číslo ostane neformátované, alebo ho formátujeme ako 3-číselné skupiny
            formattedNumber = formattedNumber.replace(/(\d{3})(?=\d)/g, '$1 ');
        }
        return formattedNumber;
    };

    const formattedPhoneNumber = formatPhoneNumber(userProfileData.contactPhoneNumber);

    return React.createElement(
        'div',
        { className: 'container mx-auto px-4 sm:px-6 lg:px-8 py-8' },
        React.createElement(
            'div',
            { className: `bg-white shadow-xl rounded-2xl p-8 max-w-4xl mx-auto border-t-8` , style: { borderColor: headerColor } },
            React.createElement(
                'div',
                { className: 'flex justify-between items-center mb-6' },
                React.createElement(
                    'h2',
                    { className: 'text-3xl font-bold text-gray-800' },
                    'Môj profil'
                ),
                React.createElement(
                    'button',
                    {
                        onClick: () => setShowModal(true),
                        className: 'flex items-center px-4 py-2 rounded-lg text-white font-medium transition-colors duration-200',
                        style: { backgroundColor: headerColor }
                    },
                    React.createElement(
                        'svg',
                        { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5 mr-2', viewBox: '0 0 20 20', fill: 'currentColor' },
                        React.createElement('path', { d: 'M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z' })
                    ),
                    'Upraviť'
                )
            ),
            React.createElement(
                'div',
                { className: 'space-y-6' },
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
                        `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || 'Nezadané'}`
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
                        formattedPhoneNumber
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
