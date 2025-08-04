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

    const isSuccess = type === 'success';
    notificationElement.textContent = message;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[99999] transition-opacity duration-300 ${isSuccess ? 'bg-green-500 text-white' : 'bg-red-500 text-white'} opacity-100`;

    // Skryť notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
    }, 5000);
};


/**
 * Hlavná React komponenta pre stránku "Moje dáta".
 * Spravuje stav používateľských dát a formulárov pre ich zmenu.
 * Táto komponenta predpokladá, že dostane platné dáta ako props.
 */
const MyDataApp = ({ userProfileData }) => {
    // Stav pre modálne okná
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

    // Načítame a sledujeme dáta používateľa v reálnom čase
    // Použijeme prop priamo, pretože vykresľovanie je podmienené existenciou dát.
    const [profileData, setProfileData] = useState(userProfileData);
    const [isSaving, setIsSaving] = useState(false);
    
    // Keď sa zmenia props, aktualizujeme stav
    useEffect(() => {
        setProfileData(userProfileData);
    }, [userProfileData]);

    const handleSaveProfile = async (updatedData) => {
        setIsSaving(true);
        try {
            if (!window.db || !profileData.id) {
                console.error("Firebase Firestore or user ID is not available.");
                window.showGlobalNotification("Chyba pri ukladaní: Nie sú dostupné dáta.", "error");
                setIsSaving(false);
                return;
            }

            const userDocRef = doc(window.db, "users", profileData.id);
            await updateDoc(userDocRef, updatedData);

            setProfileData(prevData => ({ ...prevData, ...updatedData }));
            window.showGlobalNotification("Profil bol úspešne aktualizovaný!");
            setIsProfileModalOpen(false); // Zatvoriť modálne okno po úspešnej aktualizácii
            
        } catch (error) {
            console.error("Chyba pri aktualizácii profilu:", error);
            window.showGlobalNotification(`Chyba pri aktualizácii: ${error.message}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveBilling = async (updatedData) => {
        setIsSaving(true);
        try {
            if (!window.db || !profileData.id) {
                console.error("Firebase Firestore or user ID is not available.");
                window.showGlobalNotification("Chyba pri ukladaní: Nie sú dostupné dáta.", "error");
                setIsSaving(false);
                return;
            }

            const userDocRef = doc(window.db, "users", profileData.id);
            await updateDoc(userDocRef, { billing: updatedData });

            setProfileData(prevData => ({ ...prevData, billing: updatedData }));
            window.showGlobalNotification("Fakturačné údaje boli úspešne aktualizované!");
            setIsBillingModalOpen(false); // Zatvoriť modálne okno po úspešnej aktualizácii
            
        } catch (error) {
            console.error("Chyba pri aktualizácii fakturačných údajov:", error);
            window.showGlobalNotification(`Chyba pri aktualizácii: ${error.message}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    return React.createElement('div', { className: 'max-w-4xl mx-auto py-8 px-4' },
        React.createElement('h1', { className: 'text-3xl font-bold text-gray-900 mb-8' }, 'Môj profil'),

        // Sekcia Osobné údaje
        React.createElement('div', { className: 'bg-white shadow rounded-lg p-6 mb-6' },
            React.createElement('div', { className: 'flex justify-between items-center mb-4' },
                React.createElement('h2', { className: 'text-xl font-semibold text-gray-800' }, 'Osobné údaje'),
                profileData.role === 'admin' && React.createElement('button', {
                    onClick: () => setIsProfileModalOpen(true),
                    className: 'text-gray-500 hover:text-blue-600 transition-colors duration-200'
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
                )
            ),
            React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Meno a priezvisko'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, `${profileData.firstName} ${profileData.lastName}`)
                ),
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'E-mail'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.email)
                ),
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Tel. číslo'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.phoneNumber)
                ),
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Dátum narodenia'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.birthDate)
                ),
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Adresa'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, `${profileData.address}, ${profileData.city}, ${profileData.zip}`)
                ),
                React.createElement('div', { className: 'border-b pb-2' },
                    React.createElement('p', { className: 'text-sm text-gray-500' }, 'Krajina'),
                    React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.country)
                )
            )
        ),

        // Sekcia Fakturačné údaje
        React.createElement('div', { className: 'bg-white shadow rounded-lg p-6' },
            React.createElement('div', { className: 'flex justify-between items-center mb-4' },
                React.createElement('h2', { className: 'text-xl font-semibold text-gray-800' }, 'Fakturačné údaje'),
                profileData.role === 'admin' && React.createElement('button', {
                    onClick: () => setIsBillingModalOpen(true),
                    className: 'text-gray-500 hover:text-blue-600 transition-colors duration-200'
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' },
                        React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' })
                    )
                )
            ),
            profileData.billing ? (
                React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
                    React.createElement('div', { className: 'border-b pb-2' },
                        React.createElement('p', { className: 'text-sm text-gray-500' }, 'Názov firmy'),
                        React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.billing.companyName)
                    ),
                    React.createElement('div', { className: 'border-b pb-2' },
                        React.createElement('p', { className: 'text-sm text-gray-500' }, 'Adresa'),
                        React.createElement('p', { className: 'font-medium text-gray-900' }, `${profileData.billing.address}, ${profileData.billing.city}, ${profileData.billing.zip}`)
                    ),
                    React.createElement('div', { className: 'border-b pb-2' },
                        React.createElement('p', { className: 'text-sm text-gray-500' }, 'IČO'),
                        React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.billing.companyId)
                    ),
                    React.createElement('div', { className: 'border-b pb-2' },
                        React.createElement('p', { className: 'text-sm text-gray-500' }, 'DIČ / IČ DPH'),
                        React.createElement('p', { className: 'font-medium text-gray-900' }, profileData.billing.taxId)
                    )
                )
            ) : (
                React.createElement('div', { className: 'flex items-center justify-between p-4 bg-gray-50 rounded-lg' },
                    React.createElement('p', { className: 'text-gray-500' }, 'Fakturačné údaje ešte neboli zadané.'),
                    React.createElement('button', {
                        onClick: () => setIsBillingModalOpen(true),
                        className: 'px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200'
                    }, 'Pridať údaje')
                )
            )
        ),
        
        React.createElement(ChangeProfileModal, { 
            isOpen: isProfileModalOpen,
            onClose: () => setIsProfileModalOpen(false),
            onSave: handleSaveProfile,
            initialData: profileData
        }),
        React.createElement(ChangeBillingModal, {
            isOpen: isBillingModalOpen,
            onClose: () => setIsBillingModalOpen(false),
            onSave: handleSaveBilling,
            initialData: profileData.billing
        })
    );
};

/**
 * Funkcia na vykreslenie aplikácie MyDataApp.
 * Spúšťa sa, keď sú dáta používateľa dostupné, alebo keď sa zmenia.
 */
const handleDataUpdateAndRender = (event) => {
    // Získame dáta z udalosti. Ak neexistujú, predvolene nastavíme null.
    const userProfileData = event.detail || null;
    const rootElement = document.getElementById('root');
    
    if (!rootElement || typeof ReactDOM === 'undefined' || typeof React === 'undefined') {
        console.error("MyDataApp.js: HTML element 'root' alebo React/ReactDOM nie sú dostupné.");
        return;
    }

    const root = ReactDOM.createRoot(rootElement);

    if (userProfileData && Object.keys(userProfileData).length > 0) {
        // Dáta existujú, vykreslíme hlavnú aplikáciu.
        console.log("MyDataApp.js: Vykresľujem aplikáciu s dátami používateľa.");
        root.render(React.createElement(MyDataApp, { userProfileData }));
    } else {
        // Dáta neexistujú (buď odhlásený, alebo ešte nenačítané), zobrazíme loader.
        console.log("MyDataApp.js: Dáta používateľa nie sú dostupné, zobrazujem loader.");
        root.render(
            React.createElement(
                'div',
                { className: 'flex justify-center items-center h-full pt-16' },
                React.createElement('div', { className: 'animate-spin rounded-full h-32 w-32 border-b-4 border-blue-500' })
            )
        );
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated'.
console.log("MyDataApp.js: Registrujem poslucháča pre 'globalDataUpdated'.");
window.addEventListener('globalDataUpdated', handleDataUpdateAndRender);

// Aby sme predišli premeškaniu udalosti, ak sa načíta skôr, ako sa tento poslucháč zaregistruje,
// skontrolujeme, či sú dáta už dostupné.
console.log("MyDataApp.js: Kontrolujem, či existujú globálne dáta pre počiatočné vykreslenie.");
if (window.globalUserProfileData) {
    console.log("MyDataApp.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    handleDataUpdateAndRender({ detail: window.globalUserProfileData });
} else {
    // Ak dáta nie sú dostupné pri prvom načítaní, zobrazíme loader a čakáme na udalosť.
    handleDataUpdateAndRender({ detail: null });
}
