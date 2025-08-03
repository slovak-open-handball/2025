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
        // Zmena z-indexu na vyššiu hodnotu ako má modálne okno,
        // aby sa notifikácia zobrazovala navrchu.
        notificationElement.className = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[10001] opacity-0 transition-opacity duration-300';
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
        // Pre notifikáciu typu 'info' a iné, predvolené nastavenia
        bgColorClass = 'bg-gray-800';
        textColorClass = 'text-white';
    }

    // Odstránime predchádzajúce triedy a pridáme nové
    notificationElement.className = notificationElement.className.replace(/bg-\w+-\d+/, bgColorClass);
    notificationElement.className = notificationElement.className.replace(/text-\w+/, textColorClass);
    notificationElement.textContent = message;

    // Zobrazíme notifikáciu
    setTimeout(() => {
        notificationElement.style.opacity = '1';
    }, 100);

    // Skryjeme ju po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        // Odstránime element z DOM po animácii, aby sa predišlo nahromadeniu
        setTimeout(() => {
            notificationElement.remove();
        }, 300);
    }, 5000);
};


/**
 * Komponent pre zobrazenie hlavnej aplikácie, ktorá zobrazuje užívateľské dáta
 */
const MyDataApp = ({ userProfileData, roleColor }) => {
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false); // Stav pre načítavanie
    const [userData, setUserData] = useState(userProfileData);

    // Vytvoríme referenciu na Firebase Auth a Firestore
    const firebaseConfig = JSON.parse(window.__firebase_config);
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // useEffect pre načítanie dát z Firestore na začiatku a pri zmene autentifikácie
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                // Nastavíme poslucháča na zmeny v dokumente
                const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // Ak sa dáta zmenili, aktualizujeme stav
                        if (JSON.stringify(data) !== JSON.stringify(userData)) {
                             setUserData(data);
                        }
                    } else {
                        console.log("MyDataApp: Dokument neexistuje.");
                    }
                }, (error) => {
                    console.error("MyDataApp: Chyba pri načítaní dokumentu Firestore:", error);
                    window.showGlobalNotification('Nepodarilo sa načítať užívateľské dáta.', 'error');
                });
                 // Vrátime funkciu na odhlásenie poslucháča, keď komponenta zanikne
                return unsubscribeSnapshot;
            } else {
                console.log("MyDataApp: Používateľ nie je prihlásený.");
                setUserData(null);
            }
        });
        return () => unsubscribeAuth();
    }, [auth, db, userData]);


    // Funkcia na zobrazenie modálneho okna
    const handleEditProfile = () => {
        setShowModal(true);
    };

    if (!userData) {
        return (
            <div className="flex justify-center pt-16">
                <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500"></div>
            </div>
        );
    }

    const {
        firstName,
        lastName,
        email,
        phoneNumber,
        city,
        country,
        address,
        zipCode,
        role,
        roleDescription,
    } = userData;

    // Triedy Tailwind pre farbu pozadia
    const bgColorClass = `bg-[${roleColor}]`;

    return (
        <div className="flex flex-col items-center min-h-screen pt-8 pb-16 px-4">
            <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden">
                <div className={`p-8 sm:p-12 text-white ${bgColorClass}`}>
                    <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-center">Profil používateľa</h1>
                    <p className="text-center text-sm opacity-80">{roleDescription}</p>
                </div>
                <div className="p-8 sm:p-12">
                    <div className="grid md:grid-cols-2 gap-y-6 gap-x-12 mb-8">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Meno</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{firstName}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Priezvisko</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{lastName}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">E-mail</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{email}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Telefónne číslo</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{phoneNumber || 'Nezadané'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Mesto</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{city || 'Nezadané'}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Krajina</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{country || 'Nezadané'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-sm font-medium text-gray-500">Adresa</p>
                            <p className="mt-1 text-lg text-gray-900 font-semibold">{address || 'Nezadaná'}</p>
                        </div>
                    </div>
                    <div className="text-center">
                        <button
                            onClick={handleEditProfile}
                            className={`py-3 px-8 rounded-full text-white font-semibold shadow-md transition-all duration-300 ease-in-out hover:scale-105`}
                            style={{ backgroundColor: roleColor }}
                        >
                            Upraviť profil
                        </button>
                    </div>
                </div>
            </div>

            {/* Modálne okno na úpravu profilu */}
            <ChangeProfileModal
                show={showModal}
                onClose={() => setShowModal(false)}
                userData={userData}
                roleColor={roleColor}
                setLoading={setLoading}
            />
        </div>
    );
};

// Funkcia na získanie farby roly
const getRoleColor = (role) => {
    switch (role) {
        case 'organizator':
            return '#1D4ED8'; // Modrá
        case 'veduci_skupiny':
            return '#059669'; // Zelená
        case 'dobrovolnik':
            return '#DC2626'; // Červená
        default:
            return '#4B5563'; // Sivá
    }
};


// Funkcia pre vykreslenie aplikácie MyDataApp do DOM
const handleDataUpdateAndRender = (event) => {
    const data = event.detail;
    if (data) {
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
}
