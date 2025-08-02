// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    notificationElement.innerText = message;

    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 10); // Malé oneskorenie pre spustenie animácie

    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};


/**
 * Hlavný komponent Moja zóna.
 * Zobrazuje profilové údaje používateľa a poskytuje tlačidlo na ich úpravu.
 */
const MyDataApp = () => {
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [roleColor, setRoleColor] = useState('blue');

    useEffect(() => {
        const auth = getAuth();
        const db = getFirestore();

        // Nastavenie listenera pre zmeny v autentifikácii
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const profileData = docSnap.data();

                        // Kontrola a aktualizácia emailu vo Firestore, ak sa líši
                        if (profileData.email !== user.email) {
                            console.log("Email vo Firestore sa líši od emailu v Auth. Aktualizujem...");
                            await updateDoc(userDocRef, { email: user.email });
                            profileData.email = user.email; // Aktualizujeme lokálne dáta
                            window.showGlobalNotification('E-mail bol automaticky aktualizovaný v profile.', 'success');
                        }

                        setUserProfileData({ id: docSnap.id, ...profileData });
                        
                        let color = 'blue';
                        switch (profileData.role) {
                            case 'admin':
                                color = '#47b3ff';
                                break;
                            case 'hall':
                                color = '#b06835';
                                break;
                            case 'user':
                                color = '#9333EA';
                                break;
                            default:
                                color = '#20d287';
                                break;
                        }
                        setRoleColor(color);
                    } else {
                        console.error("Profil používateľa nebol nájdený!");
                        setUserProfileData(null);
                    }
                } catch (error) {
                    console.error("Chyba pri načítaní profilu:", error);
                    setUserProfileData(null);
                } finally {
                    setLoading(false);
                }
            } else {
                console.log("Používateľ odhlásený.");
                setUserProfileData(null);
                setLoading(false);
            }
        });

        // Upratovanie po zrušení komponentu
        return () => unsubscribe();
    }, []);

    // Loader
    if (loading) {
        return React.createElement(
            'div',
            { className: 'flex justify-center items-center h-screen' },
            React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
        );
    }

    if (!userProfileData) {
        return React.createElement(
            'div',
            { className: 'text-center p-8' },
            React.createElement('p', { className: 'text-gray-500' }, 'Používateľ nie je prihlásený, alebo nastala chyba pri načítaní profilu.')
        );
    }

    const formattedPhoneNumber = userProfileData.contactPhoneNumber ?
        userProfileData.contactPhoneNumber.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : 'Nezadané';

    return React.createElement(
        'div',
        { className: 'bg-white shadow-xl rounded-2xl overflow-hidden' },
        React.createElement(
            'div',
            { className: 'p-6 sm:p-8 text-white flex justify-between items-center', style: { backgroundColor: roleColor } },
            React.createElement('h2', { className: 'text-2xl sm:text-3xl font-bold' }, 'Moje údaje'),
            React.createElement(
                'button',
                {
                    onClick: () => setShowModal(true),
                    className: 'flex items-center px-4 py-2 bg-white text-gray-800 rounded-lg shadow-md font-medium hover:bg-gray-100 transition-colors duration-200'
                },
                React.createElement('svg', { className: 'h-5 w-5 mr-2', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                ),
                'Upraviť'
            )
        ),
        React.createElement(
            'div',
            { className: 'p-6 sm:p-8 space-y-6' },
            React.createElement(
                'div',
                { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
                // Meno
                React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800' },
                        'Meno a Priezvisko:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        `${userProfileData.firstName || 'Nezadané'} ${userProfileData.lastName || 'Nezadané'}`
                    )
                ),
                // Telefónne číslo - zobrazené len pre ne-admin roly
                userProfileData.role !== 'admin' && React.createElement(
                    'div',
                    { className: 'flex flex-col' },
                    React.createElement(
                        'p',
                        { className: 'font-bold text-gray-800' },
                        'Telefónne číslo:'
                    ),
                    React.createElement(
                        'p',
                        { className: 'text-gray-800 text-lg mt-1' },
                        formattedPhoneNumber || 'Nezadané'
                    )
                ),
                // E-mail
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
            roleColor: roleColor
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
