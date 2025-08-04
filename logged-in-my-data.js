// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

const { useState, useEffect } = React;

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
 * Funkcia na overenie a vrátenie obsahu, alebo znaku '-' ak je hodnota prázdna
 * @param {string} value - Hodnota, ktorá sa má zobraziť.
 * @returns {string} - Pôvodná hodnota alebo znak '-'.
 */
const checkValue = (value) => {
    return value && value.trim() !== '' ? value : '-';
};

/**
 * Funkcia na formátovanie PSČ
 * @param {string} postalCode - PSČ vo formáte xxxxx.
 * @returns {string} - Formátované PSČ vo formáte xxx xx.
 */
const formatPostalCode = (postalCode) => {
    if (postalCode && postalCode.length === 5) {
        return `${postalCode.substring(0, 3)} ${postalCode.substring(3)}`;
    }
    return checkValue(postalCode);
};

/**
 * Funkcia na formátovanie telefónneho čísla
 * @param {string} phoneNumber - Telefónne číslo vrátane predvoľby (napr. +421901234567).
 * @returns {string} - Formátované telefónne číslo alebo '-'.
 */
const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) {
        return '-';
    }

    // Nájdenie najdlhšej predvoľby, ktorá zodpovedá začiatku čísla
    const matchingDialCode = countryDialCodes
        .sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find(country => phoneNumber.startsWith(country.dialCode));

    if (matchingDialCode) {
        const countryCode = matchingDialCode.dialCode;
        const number = phoneNumber.substring(countryCode.length).replace(/\s/g, '');
        // Rozdelenie zvyšku čísla do skupín po troch
        const formattedNumber = number.match(/.{1,3}/g)?.join(' ');
        return `${countryCode} ${formattedNumber}`;
    }

    // Ak sa predvoľba nenájde, vrátime pôvodné číslo
    return phoneNumber;
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
    const [showBillingModal, setShowBillingModal] = useState(false); // Nový stav pre fakturačné údaje

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
        
        // Získame farbu pozadia hlavného boxu
        const mainBoxColor = getRoleColor(data.role);
        const contactLabelColor = 'text-gray-500';
        const contactValueColor = 'text-gray-900';
        const invertedButtonColor = getRoleColor(data.role);

        // Vytvorenie reťazca pre fakturačnú adresu
        const billingAddress = `${checkValue(data.street)} ${checkValue(data.houseNumber)}`.trim().replace(/- -/, '-');
        const billingAddress2 = `${formatPostalCode(data.postalCode)} ${checkValue(data.city)}`.trim().replace(/- -/, '-');
        const billingAddress3 = `${checkValue(data.country)}`;
        const fullBillingAddress = `${billingAddress}${billingAddress ? ', ' : ''}${billingAddress2}${billingAddress2 ? ', ' : ''}${billingAddress3}`.trim().replace(/^,|,$/g, '').trim();

        return React.createElement(
            'div',
            { className: 'max-w-4xl mx-auto' },
            // Profilový box
            React.createElement(
                'div',
                { className: `bg-white rounded-xl shadow-xl mb-8` },
                React.createElement(
                    'div',
                    { className: `rounded-t-xl px-8 py-6 md:px-12 md:py-8`, style: { backgroundColor: mainBoxColor } },
                    React.createElement(
                        'div',
                        { className: 'flex justify-between items-center flex-wrap gap-4' },
                        // Ľavá strana: Meno
                        React.createElement(
                            'div',
                            { className: 'flex-1 min-w-0' },
                            React.createElement(
                                'h1',
                                { className: `text-3xl md:text-4xl font-bold text-white truncate` }, // Farba nadpisu je vždy biela
                                data.role === 'user'
                                    ? 'Údaje kontaktnej osoby'
                                    : data.role === 'hall' || data.role === 'admin'
                                        ? 'Moje údaje'
                                        : `${checkValue(data.firstName)} ${checkValue(data.lastName)}`
                            )
                        ),
                        // Pravá strana: Tlačidlo Upraviť
                        React.createElement(
                            'button',
                            {
                                onClick: () => setShowModal(true),
                                className: `flex items-center space-x-2 px-6 py-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50`,
                                style: { backgroundColor: 'white', color: invertedButtonColor }
                            },
                            // Ikona ceruzky SVG
                            React.createElement(
                                'svg',
                                { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", },
                                React.createElement('path', { d: "M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" })
                            ),
                            React.createElement('span', null, 'Upraviť')
                        )
                    ),
                ),
                React.createElement(
                    'div',
                    { className: 'px-8 py-6 md:px-12 md:py-8' },
                    // Riadky s kontaktnými údajmi
                    React.createElement(
                        'div',
                        { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
                        // Riadok s E-mailom
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'E-mailová adresa'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(data.email))
                        ),
                        // Riadok s Telefónnym číslom
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'Telefónne číslo'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, formatPhoneNumber(data.contactPhoneNumber))
                        ),
                        // Riadok s Rolou
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'Rola'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(data.role))
                        ),
                    ),
                    // Riadok s fakturačnými údajmi
                    React.createElement('div', { className: 'mt-10' }),
                    React.createElement('hr', { className: 'my-6' }),
                    React.createElement(
                        'div',
                        { className: 'flex justify-between items-center flex-wrap gap-4' },
                        React.createElement(
                            'h2',
                            { className: `text-2xl font-bold text-gray-900` },
                            'Fakturačné údaje'
                        ),
                        // Tlačidlo na úpravu fakturačných údajov
                        React.createElement(
                            'button',
                            {
                                onClick: () => setShowBillingModal(true),
                                className: `flex items-center space-x-2 px-6 py-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50`,
                                style: { backgroundColor: 'white', color: invertedButtonColor }
                            },
                             // Ikona ceruzky SVG
                            React.createElement(
                                'svg',
                                { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", },
                                React.createElement('path', { d: "M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" })
                            ),
                            React.createElement('span', null, 'Upraviť')
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
                        // Riadok s fakturačnou adresou
                        React.createElement(
                            'div',
                            { className: 'col-span-1 md:col-span-2' },
                            React.createElement('p', { className: contactLabelColor }, 'Adresa'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(fullBillingAddress))
                        ),
                        // Riadok s IČO
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'IČO'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(data.ico))
                        ),
                        // Riadok s DIČ
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'DIČ'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(data.dic))
                        ),
                        // Riadok s IČ DPH
                        React.createElement(
                            'div',
                            null,
                            React.createElement('p', { className: contactLabelColor }, 'IČ DPH'),
                            React.createElement('p', { className: `text-lg font-semibold ${contactValueColor}` }, checkValue(data.icdph))
                        ),
                    ),
                )
            ),
            // Modálne okno pre úpravu profilu
            React.createElement(ChangeProfileModal, {
                show: showModal,
                onClose: () => setShowModal(false),
                userProfileData: data,
                roleColor: roleColor
            }),
            // Modálne okno pre úpravu fakturačných údajov
            React.createElement(ChangeBillingModal, {
                show: showBillingModal,
                onClose: () => setShowBillingModal(false),
                userProfileData: data,
                roleColor: roleColor
            })
        );
    };

    return renderContent();
};

const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#0D9488'; // teal-600
        case 'user':
            return '#1D4ED8'; // blue-700
        case 'hall':
            return '#9D174D'; // pink-800
        default:
            return '#4B5563'; // gray-600
    }
};

const handleDataUpdateAndRender = (event) => {
    console.log("MyDataApp.js: Udalosť 'globalDataUpdated' prijatá.");
    const data = event.detail;
    if (data && Object.keys(data).length > 0) {
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
    // Ak dáta nie sú dostupné, čakáme na event listener, zatiaľ zobrazíme loader
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(React.createElement(MyDataApp, { userProfileData: null, roleColor: null }));
    }
}
