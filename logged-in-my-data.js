// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Použijeme onSnapshot namiesto getDoc pre real-time aktualizácie
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

// Zabezpečenie, že konfigurácia je globálne dostupná
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

// Inicializácia Firebase až po skontrolovaní, či je konfigurácia k dispozícii
const app = Object.keys(firebaseConfig).length ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

// Hlavný komponent aplikácie
const MyDataApp = () => {
    // Definícia stavov pre používateľské dáta, načítavanie, chyby, modálne okno, a informácie o používateľovi
    const [userProfileData, setUserProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [user, setUser] = useState(null);

    // useEffect pre prihlásenie používateľa
    useEffect(() => {
        if (!auth) {
            console.error("Firebase Auth nie je k dispozícii.");
            setError("Chyba inicializácie: Firebase Auth nie je k dispozícii.");
            setLoading(false);
            return;
        }

        // Nastavenie listenera na zmeny autentifikačného stavu
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                console.log("Žiadny prihlásený používateľ.");
                setUser(null);
                setUserProfileData(null);
                setLoading(false);
            }
        });

        // Cleanup funkcia pre odhlásenie listenera
        return () => unsubscribe();
    }, []);

    // useEffect pre načítanie používateľských dát z Firestore
    useEffect(() => {
        if (user && db) {
            setLoading(true);
            const userDocRef = doc(db, 'users', user.uid);

            // Použitie onSnapshot na sledovanie zmien v dokumente v reálnom čase
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    console.log("MyDataApp.js: Údaje z Firestore sa aktualizovali.", data);
                    setUserProfileData(data);
                } else {
                    console.error("MyDataApp.js: Dokument používateľa nebol nájdený!");
                    setError("Chyba: Profilové údaje neboli nájdené.");
                    setUserProfileData(null);
                }
                setLoading(false);
            }, (error) => {
                console.error("MyDataApp.js: Chyba pri načítavaní dokumentu v reálnom čase:", error);
                setError("Chyba pri načítavaní profilu.");
                setLoading(false);
            });

            // Cleanup funkcia pre odhlásenie listenera, keď sa komponent odpojí
            return () => unsubscribe();
        } else if (!user) {
            // Ak nie je používateľ, ukončíme načítavanie
            setLoading(false);
        }
    }, [user, db]);

    // Vytvorenie farby role
    const roleColor = userProfileData?.role === 'admin' ? '#ef4444' : '#3b82f6';
    const roleBgColor = userProfileData?.role === 'admin' ? 'bg-red-500' : 'bg-blue-500';

    // Stav načítavania
    if (loading || !user) {
        return (
            React.createElement('div', { className: 'flex justify-center pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }

    // Stav chyby
    if (error) {
        return React.createElement('div', { className: 'text-center text-red-500 mt-16' },
            React.createElement('p', null, error),
            React.createElement('p', null, 'Skúste sa prosím odhlásiť a znova prihlásiť.')
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

    // Vytvorenie komponentu pre riadok s údajmi
    const DataRow = ({ label, value }) => (
        React.createElement('div', { className: 'flex flex-col md:flex-row md:items-center py-4 border-b border-gray-200' },
            React.createElement('p', { className: 'font-bold text-gray-800 w-full md:w-1/3' }, label),
            React.createElement('p', { className: 'text-gray-800 text-lg mt-1 md:mt-0 w-full md:w-2/3' }, value || 'Nezadané')
        )
    );

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
                // Riadky s údajmi
                React.createElement(DataRow, { label: 'Meno a Priezvisko:', value: `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim() }),
                userProfileData?.role !== 'admin' &&
                React.createElement(DataRow, { label: 'Telefónne číslo:', value: formatPhoneNumber(userProfileData.phoneNumber) }),
                React.createElement(DataRow, { label: 'E-mailová adresa:', value: userProfileData.email }),
                React.createElement(DataRow, { label: 'Rola:', value: userProfileData.role })
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
