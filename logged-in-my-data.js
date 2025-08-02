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
    } else {
        bgColorClass = 'bg-red-100';
        textColorClass = 'text-red-800';
    }
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.innerHTML = message;

    // Animácia fade-in
    setTimeout(() => {
        notificationElement.classList.add('opacity-100');
    }, 10);

    // Animácia fade-out po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
    }, 5000);
};

/**
 * Hlavný React komponent pre zobrazenie údajov prihláseného používateľa.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [headerColor, setHeaderColor] = useState('#1e40af'); // Predvolená farba pre hlavičku

    useEffect(() => {
        const unsubscribe = window.onAuthStateChanged(window.auth, async (user) => {
            if (user) {
                const db = window.db;
                if (db) {
                    const userDocRef = doc(db, 'users', user.uid);
                    try {
                        const docSnap = await getDoc(userDocRef);
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setUserProfileData({ id: docSnap.id, ...data });

                            // Nastavenie farby hlavičky na základe roly
                            if (data.role === 'admin') {
                                setHeaderColor('#ef4444');
                            } else if (data.role === 'trainer') {
                                setHeaderColor('#f97316');
                            } else {
                                setHeaderColor('#1e40af');
                            }

                        } else {
                            console.error("logged-in-my-data.js: Profil používateľa nebol nájdený!");
                            setUserProfileData(null);
                        }
                    } catch (error) {
                        console.error("logged-in-my-data.js: Chyba pri načítaní profilu:", error);
                        setUserProfileData(null);
                    }
                } else {
                    console.error("logged-in-my-data.js: Firestore databáza nie je inicializovaná.");
                }
            } else {
                setUserProfileData(null);
            }
            setLoading(false);
        });

        // Cleanup funkcia pri odpojení komponentu
        return () => unsubscribe();
    }, []);

    // Loader počas načítavania dát
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center pt-16' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500' })
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'container mx-auto px-4 py-8 text-center text-gray-500' },
            React.createElement('p', null, 'Dáta neboli nájdené. Skúste sa prosím prihlásiť znova.')
        );
    }

    // Funkcia na formátovanie telefónneho čísla
    const formatPhoneNumber = (phoneNumber) => {
        if (!phoneNumber) return 'Nezadané';
        const cleaned = phoneNumber.replace(/\s/g, ''); // Odstránenie medzier
        const dialCodeRegex = new RegExp(`^(\\${countryDialCodes.map(c => c.dialCode).sort((a,b) => b.length - a.length).join('|\\')})`);
        const match = cleaned.match(dialCodeRegex);

        let numberWithoutDialCode = cleaned;
        if (match) {
            numberWithoutDialCode = cleaned.substring(match[0].length);
        }

        // Zoskupí číslice po troch a oddelí ich medzerou
        const formattedNumber = numberWithoutDialCode.match(/.{1,3}/g)?.join(' ') || '';
        return match ? `${match[0]} ${formattedNumber}` : formattedNumber;
    };

    const formattedPhoneNumber = formatPhoneNumber(userProfileData.contactPhoneNumber);

    return React.createElement(
        'div',
        { className: 'relative max-w-2xl mx-auto my-8 p-6 bg-white rounded-xl shadow-lg border border-gray-200' },
        // Hlavička a tlačidlo úpravy
        React.createElement(
            'div',
            { className: 'flex justify-between items-center mb-6' },
            React.createElement('h1', { className: 'text-2xl font-bold text-gray-800' }, 'Môj profil'),
            React.createElement(
                'button',
                {
                    onClick: () => setShowModal(true),
                    className: `flex items-center px-4 py-2 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200`,
                    style: { backgroundColor: headerColor }
                },
                React.createElement(
                    'svg',
                    { className: 'h-5 w-5 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                'Upraviť'
            )
        ),

        // Detailné informácie o používateľovi
        React.createElement(
            'div',
            { className: 'grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12' },
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement('p', { className: 'font-bold text-gray-800 flex items-center' }, 'Meno:'),
                React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || 'Nezadané'}`)
            ),
            // Podmienene zobrazenie telefónneho čísla
            userProfileData.role !== 'admin' && React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement('p', { className: 'font-bold text-gray-800 flex items-center' }, 'Telefónne číslo kontaktnej osoby:'),
                React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, formattedPhoneNumber)
            ),
            React.createElement(
                'div',
                { className: 'flex flex-col' },
                React.createElement('p', { className: 'font-bold text-gray-800 flex items-center' }, 'E-mailová adresa kontaktnej osoby:'),
                React.createElement('p', { className: 'text-gray-800 text-lg mt-1' }, `${userProfileData.email || 'Nezadané'}`)
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
