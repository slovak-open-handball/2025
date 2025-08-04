// Importy pre Firebase funkcie
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getFirestore, getDoc, onSnapshot, updateDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Import komponentu pre modálne okno, ktorý je teraz v samostatnom súbore
import { ChangeProfileModal } from "./logged-in-my-data-change-profile-modal.js";
import { ChangeBillingModal } from "./logged-in-my-data-change-billing-modal.js";

const { useState, useEffect, useRef } = React;

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

    const baseClasses = 'fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-all duration-500 ease-in-out transform';
    let typeClasses = '';
    switch (type) {
        case 'success':
            typeClasses = 'bg-green-500 text-white';
            break;
        case 'error':
            typeClasses = 'bg-red-500 text-white';
            break;
        case 'info':
            typeClasses = 'bg-blue-500 text-white';
            break;
        default:
            typeClasses = 'bg-gray-700 text-white';
    }

    notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    notificationElement.textContent = message;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-100 scale-100`;
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.className = `${baseClasses} ${typeClasses} opacity-0 scale-95`;
    }, 5000);
};

const ProfileSection = ({ userProfileData, onOpenProfileModal, onOpenBillingModal }) => {
    const roleColors = {
        'admin': 'bg-red-500',
        'super-admin': 'bg-red-700',
        'referee': 'bg-orange-500',
        'athlete': 'bg-green-500',
        'coach': 'bg-blue-500',
        'hall': 'bg-purple-500',
    };
    const roleColor = roleColors[userProfileData?.role] || 'bg-gray-500';

    const getFullRoleName = (role) => {
        switch (role) {
            case 'admin':
                return 'Administrátor';
            case 'super-admin':
                return 'Super Administrátor';
            case 'referee':
                return 'Rozhodca';
            case 'athlete':
                return 'Športovec';
            case 'coach':
                return 'Tréner';
            case 'hall':
                return 'Správca haly';
            default:
                return 'Používateľ';
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-8">
            {/* Sekcia Ľavý stĺpec - Profilové informácie */}
            <div className={`flex-1 rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01] ${roleColor} text-white`}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold tracking-tight">Môj Profil</h2>
                    <button
                        onClick={onOpenProfileModal}
                        className="p-2 rounded-full text-white hover:bg-white hover:text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="Upraviť profil"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                <div className="space-y-4 text-lg">
                    <p><strong>Rola:</strong> <span className="font-semibold">{getFullRoleName(userProfileData.role)}</span></p>
                    <p><strong>Meno:</strong> {userProfileData.firstName}</p>
                    <p><strong>Priezvisko:</strong> {userProfileData.lastName}</p>
                    <p><strong>Email:</strong> {userProfileData.email}</p>
                    <p><strong>Telefón:</strong> {userProfileData.dialCode} {userProfileData.phone}</p>
                    <p><strong>Adresa:</strong> {userProfileData.address}</p>
                    {userProfileData.role === 'referee' && (
                        <p><strong>Licencia Rozhodcu:</strong> {userProfileData.refereeLicense}</p>
                    )}
                    {userProfileData.club && userProfileData.club !== '' && (
                        <p><strong>Klub:</strong> {userProfileData.club}</p>
                    )}
                </div>
            </div>

            {/* Sekcia Pravý stĺpec - Fakturačné údaje */}
            {(userProfileData.role === 'admin' || userProfileData.role === 'hall') ? null : (
                <div className="flex-1 bg-white rounded-xl shadow-xl p-8 transform transition-all duration-500 hover:scale-[1.01]">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-800">Fakturačné údaje</h2>
                        <button
                            onClick={onOpenBillingModal}
                            className="p-2 rounded-full text-gray-800 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                            aria-label="Upraviť fakturačné údaje"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                    <div className="space-y-4 text-gray-700 text-lg">
                        <p><strong>Názov klubu:</strong> {userProfileData.billing?.clubName || '-'}</p>
                        <p><strong>Adresa:</strong> {userProfileData.billing?.street || '-'} {userProfileData.billing?.houseNumber || '-'}</p>
                        <p><strong>Mesto:</strong> {userProfileData.billing?.city || '-'}</p>
                        <p><strong>PSČ:</strong> {userProfileData.billing?.postalCode || '-'}</p>
                        <p><strong>Krajina:</strong> {userProfileData.billing?.country || '-'}</p>
                        <p><strong>IČO:</strong> {userProfileData.billing?.ico || '-'}</p>
                        <p><strong>DIČ:</strong> {userProfileData.billing?.dic || '-'}</p>
                        <p><strong>IČ DPH:</strong> {userProfileData.billing?.icdph || '-'}</p>
                    </div>
                </div>
            )}
        </div>
    );
};


const MyDataApp = ({ userProfileData }) => {
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);

    // Ak sa dáta používateľa zmenia, zatvoríme modálne okná
    useEffect(() => {
        if (userProfileData) {
            setShowProfileModal(false);
            setShowBillingModal(false);
        }
    }, [userProfileData]);

    const roleColors = {
        'admin': 'bg-red-500',
        'super-admin': 'bg-red-700',
        'referee': 'bg-orange-500',
        'athlete': 'bg-green-500',
        'coach': 'bg-blue-500',
        'hall': 'bg-purple-500',
    };
    const roleColor = roleColors[userProfileData?.role] || 'bg-gray-500';

    return (
        <div className="flex-grow">
            <ProfileSection
                userProfileData={userProfileData}
                onOpenProfileModal={() => setShowProfileModal(true)}
                onOpenBillingModal={() => setShowBillingModal(true)}
            />
            {/* Modálne okná */}
            <ChangeProfileModal
                show={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                userProfileData={userProfileData}
                roleColor={roleColor}
            />
            <ChangeBillingModal
                show={showBillingModal}
                onClose={() => setShowBillingModal(false)}
                userProfileData={userProfileData}
                roleColor={roleColor}
            />
        </div>
    );
};

/**
 * Táto funkcia je poslucháčom udalosti 'globalDataUpdated'.
 * Akonáhle sa dáta používateľa načítajú, vykreslí aplikáciu MyDataApp.
 */
const handleDataUpdateAndRender = (event) => {
    const userProfileData = event.detail;
    const rootElement = document.getElementById('root');

    if (userProfileData) {
        if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
            const root = ReactDOM.createRoot(rootElement);
            root.render(React.createElement(MyDataApp, { userProfileData }));
            console.log(\"MyDataApp.js: Aplikácia bola úspešne vykreslená po udalosti 'globalDataUpdated'.\");
        } else {
            console.error(\"MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.\");
        }
    } else {
        console.error(\"MyDataApp.js: Dáta používateľa nie sú dostupné v udalosti 'globalDataUpdated'.\");
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log(\"MyDataApp.js: Registrujem poslucháča pre 'globalDataUpdated'.\");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log(\"MyDataApp.js: Kontrolujem, či existujú globálne dáta.\");
if (window.globalUserProfileData) {
    console.log(\"MyDataApp.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.\");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // Ak dáta nie sú dostupné, čakáme na event listener, zatiaľ zobrazíme loader
    const rootElement = document.getElementById('root');
    if (rootElement && typeof ReactDOM !== 'undefined' && typeof React !== 'undefined') {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
}
