// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./ChangeProfileModal.js";

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
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return 'bg-red-500';
            case 'hall': return 'bg-orange-500';
            case 'user': return 'bg-blue-500';
            default: return 'bg-gray-500';
        }
    };

    const headerColor = getRoleColor(userProfileData?.role);

    const fetchUserData = async (user, dbInstance) => {
        if (!user || !dbInstance) return;
        try {
            const userDocRef = doc(dbInstance, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                setUserProfileData({ id: docSnap.id, ...docSnap.data(), email: user.email });
            } else {
                console.warn("Profil používateľa nebol nájdený v databáze Firestore.");
                setUserProfileData({ id: user.uid, email: user.email, firstName: '', lastName: '', contactPhoneNumber: '' });
            }
        } catch (e) {
            console.error("Chyba pri načítaní profilu používateľa:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
            const initializedApp = initializeApp(firebaseConfig);
            const authInstance = getAuth(initializedApp);
            const dbInstance = getFirestore(initializedApp);

            setAuth(authInstance);
            setDb(dbInstance);
            window.app = initializedApp;

            const unsubscribe = onAuthStateChanged(authInstance, (user) => {
                if (user) {
                    fetchUserData(user, dbInstance);
                } else {
                    setUserProfileData(null);
                    setLoading(false);
                }
            });

            return () => unsubscribe();
        };

        if (typeof window.firebase === 'undefined') {
            console.error("Firebase SDK nebolo načítané.");
            setLoading(false);
        } else {
            init();
        }

        const handleDataUpdate = () => {
            if (auth && db && auth.currentUser) {
                fetchUserData(auth.currentUser, db);
            }
        };
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
        { className: 'min-h-screen bg-gray-100 flex flex-col items-center py-8' },
        React.createElement(
            'div',
            { className: 'bg-white shadow-lg rounded-xl w-full max-w-2xl overflow-hidden' },
            React.createElement(
                'div',
                { className: `${headerColor} text-white px-6 py-4 flex justify-between items-center` },
                React.createElement('h1', { className: 'text-2xl font-bold' }, 'Moje údaje'),
                React.createElement(
                    'button',
                    { onClick: () => setShowModal(true), className: 'text-white hover:text-gray-200' },
                    React.createElement('i', { className: 'fa-solid fa-edit text-xl' })
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
        React.createElement(ChangeProfileModal, {
            show: showModal,
            onClose: () => setShowModal(false),
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
