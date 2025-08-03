// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
 * Funkcia na porovnanie starých a nových dát a zápis zmien do kolekcie '/notification'.
 * @param {object} oldData - Pôvodné dáta profilu.
 * @param {object} newData - Nové dáta profilu.
 */
const logProfileChanges = async (oldData, newData) => {
    const db = getFirestore();
    const notificationsCollection = collection(db, "notification");
    const changes = [];

    // Porovnanie top-level fieldov
    for (const key of Object.keys(newData)) {
        if (typeof newData[key] === 'object' && newData[key] !== null) {
            // Spracovanie vnorených objektov (napr. 'billing')
            for (const subKey of Object.keys(newData[key])) {
                if (oldData[key] && oldData[key][subKey] !== newData[key][subKey]) {
                    changes.push({
                        field: `${key}.${subKey}`,
                        oldValue: oldData[key][subKey] || '-',
                        newValue: newData[key][subKey] || '-'
                    });
                }
            }
        } else if (oldData[key] !== newData[key]) {
            changes.push({
                field: key,
                oldValue: oldData[key] || '-',
                newValue: newData[key] || '-'
            });
        }
    }
    
    console.log("Zmeny v profile na zaznamenanie:", changes);

    // Vytvorenie dokumentu pre každú zmenu
    for (const change of changes) {
        const message = `Používateľ zmenil údaj '${change.field}' z hodnoty '${change.oldValue}' na hodnotu '${change.newValue}'.`;
        try {
            await addDoc(notificationsCollection, {
                message: message,
                timestamp: serverTimestamp(),
                userId: getAuth().currentUser.uid
            });
            console.log("Zmena profilu úspešne zaznamenaná:", message);
        } catch (error) {
            console.error("Chyba pri zápise zmeny do notifikácií:", error);
        }
    }
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

    const handleProfileUpdate = (newData) => {
        // Zaznamenanie zmeny profilu pred aktualizáciou stavu
        logProfileChanges(data, newData);
        
        setData(newData);
        setShowModal(false);
    };

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
                                style: {
                                    backgroundColor: 'white',
                                    color: invertedButtonColor
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
                            'Upraviť'
                        )
                    ),
                ),
                // Sekcia s kontaktnými údajmi
                React.createElement(
                    'div',
                    { className: 'p-8 md:p-12' },
                    React.createElement(
                        'dl',
                        { className: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' },
                        // Meno a priezvisko
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'Meno a priezvisko'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(`${data.firstName || ''} ${data.lastName || ''}`.trim())
                            )
                        ),
                        // E-mailová adresa
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'E-mailová adresa'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(data.email)
                            )
                        ),
                        // Telefónne číslo (zobrazí sa iba ak používateľ nie je admin)
                        data.role !== 'admin' && React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'Telefónne číslo'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                formatPhoneNumber(data.contactPhoneNumber)
                            )
                        )
                    )
                )
            ),
            // Fakturačný box (zobrazí sa iba ak používateľ nie je admin)
            data.role !== 'admin' && React.createElement(
                'div',
                { className: `bg-white rounded-xl shadow-xl mb-8` },
                React.createElement(
                    'div',
                    { className: `rounded-t-xl px-8 py-6 md:px-12 md:py-8`, style: { backgroundColor: mainBoxColor } },
                    React.createElement(
                        'div',
                        { className: 'flex justify-between items-center flex-wrap gap-4' },
                        React.createElement(
                            'div',
                            { className: 'flex-1 min-w-0' },
                            React.createElement(
                                'h1',
                                { className: `text-3xl md:text-4xl font-bold text-white truncate` },
                                'Fakturačné údaje'
                            )
                        )
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'p-8 md:p-12' },
                    React.createElement(
                        'dl',
                        { className: 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6' },
                        // Oficiálny názov klubu
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'Oficiálny názov klubu'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(data.billing?.clubName)
                            )
                        ),
                        // Fakturačná adresa
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'Fakturačná adresa'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(fullBillingAddress)
                            )
                        ),
                        // IČO
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'IČO'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(data.billing?.ico)
                            )
                        ),
                        // DIČ
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'DIČ'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(data.billing?.dic)
                            )
                        ),
                        // IČ DPH
                        React.createElement(
                            'div',
                            null,
                            React.createElement(
                                'dt',
                                { className: `text-sm font-medium ${contactLabelColor}` },
                                'IČ DPH'
                            ),
                            React.createElement(
                                'dd',
                                { className: `mt-1 ${contactValueColor} font-semibold` },
                                checkValue(data.billing?.icDph)
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
                roleColor: getRoleColor(data.role),
                onProfileUpdated: handleProfileUpdate // Použijeme novú funkciu
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

// Pomocná funkcia na určenie kontrastnej farby textu (čierna alebo biela)
const getContrastTextColor = (hexcolor) => {
    // Ak je farba v šesťhrannom formáte, vypočítame jas
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
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
    console.error("MyDataApp.js: Globálne dáta ešte neexistujú. Čakám na udalosť 'globalDataUpdated'.");
}
