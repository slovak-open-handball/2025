// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Kód bol refaktorovaný, aby sa načítanie statického HTML oddelilo od dynamickej logiky
// a aby sa predišlo problémom s načítaním súboru header.html.

// Importy pre potrebné Firebase funkcie
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Globálna premenná na uloženie ID intervalu, aby sme ho mohli neskôr zrušiť
let registrationCheckIntervalId = null;

// Zoznam aktívnych notifikácií
let activeNotifications = [];

// Flag, ktorý zabráni opakovanému spúšťaniu inicializácie hlavičky
let headerInitialized = false;

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
        // Používame Tailwind CSS triedy pre štýlovanie a animáciu
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
    } else if (type === 'info') {
        bgColorClass = 'bg-blue-500';
        textColorClass = 'text-white';
    } else {
        bgColorClass = 'bg-gray-700';
        textColorClass = 'text-white';
    }
    
    // Nastavenie obsahu a tried pre zobrazenie
    notificationElement.textContent = message;
    notificationElement.className = `fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-[9999] opacity-0 transition-opacity duration-300 ${bgColorClass} ${textColorClass}`;
    
    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.remove('opacity-0');
        notificationElement.classList.add('opacity-100');
    }, 10);
    
    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0');
    }, 5000);
};


/**
 * Funkcia na zobrazenie pop-up notifikácie pre admina.
 * @param {string} message - Správa, ktorá sa zobrazí.
 */
const showAdminNotification = (message) => {
    // Vytvoríme nový element pre notifikáciu
    const notificationElement = document.createElement('div');
    notificationElement.className = `
        fixed top-4 right-4 z-[99999] p-4 rounded-lg shadow-xl text-white font-semibold bg-gray-800
        transform translate-x-full transition-transform duration-500 ease-in-out
        flex items-center space-x-2
    `;
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6.222 8.324 6.222 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span>${message}</span>
    `;

    document.body.appendChild(notificationElement);

    // Pridanie notifikácie do zoznamu
    activeNotifications.push(notificationElement);

    // Animácia zobrazenia
    setTimeout(() => {
        notificationElement.style.transform = 'translateX(0)';
    }, 50);

    // Automatické skrytie po 8 sekundách
    setTimeout(() => {
        notificationElement.style.transform = 'translateX(120%)'; // Skrytie doprava
        // Po skončení animácie element odstránime
        notificationElement.addEventListener('transitionend', () => {
            notificationElement.remove();
            // Odstránenie notifikácie zo zoznamu
            activeNotifications = activeNotifications.filter(n => n !== notificationElement);
        });
    }, 8000);
};

/**
 * Funkcia, ktorá obsluhuje odhlásenie používateľa
 */
const handleLogout = async () => {
    try {
        const auth = getAuth();
        await signOut(auth);
        console.log("header.js: Používateľ bol úspešne odhlásený.");
        window.location.href = '/';
    } catch (error) {
        console.error("header.js: Chyba pri odhlasovaní:", error);
        window.showGlobalNotification("Chyba pri odhlasovaní: " + error.message, 'error');
    }
};

/**
 * Funkcia na získanie farby hlavičky podľa roly
 * @param {string} role - Rola používateľa
 */
const getHeaderColorByRole = (role) => {
    switch (role) {
        case 'admin': return 'bg-red-600 hover:bg-red-700';
        case 'organization': return 'bg-orange-600 hover:bg-orange-700';
        case 'judge': return 'bg-green-600 hover:bg-green-700';
        default: return 'bg-gray-800 hover:bg-gray-700';
    }
};

/**
 * Funkcia, ktorá dynamicky aktualizuje odkazy v hlavičke na základe stavu používateľa.
 * @param {object} userProfileData - Dáta profilu používateľa.
 */
const updateHeaderLinks = (userProfileData) => {
    const headerElement = document.getElementById('main-header');
    const headerLinks = document.getElementById('header-links');

    if (!headerElement || !headerLinks) {
        return;
    }

    // Vyčistíme staré odkazy
    headerLinks.innerHTML = '';
    
    // Získame farbu hlavičky na základe roly
    const headerColorClass = getHeaderColorByRole(userProfileData?.role);
    headerElement.className = `p-4 text-white shadow-md transition-colors duration-300 ${headerColorClass}`;

    // Podmienene zobrazíme odkazy podľa stavu prihlásenia
    if (userProfileData && userProfileData.isLoggedIn) {
        const dashboardLink = document.createElement('a');
        dashboardLink.href = userProfileData.role === 'admin' ? '/admin-dashboard.html' : '/logged-in-my-data.html';
        dashboardLink.className = 'px-3 py-2 rounded-md text-sm font-medium hover:bg-white hover:text-gray-900 transition-colors duration-300';
        dashboardLink.textContent = userProfileData.role === 'admin' ? 'Admin Dashboard' : 'Môj Profil';
        headerLinks.appendChild(dashboardLink);
        
        // Pridáme odkaz na odhlásenie
        const logoutLink = document.createElement('button');
        logoutLink.id = 'logout-button';
        logoutLink.className = 'px-3 py-2 rounded-md text-sm font-medium hover:bg-white hover:text-gray-900 transition-colors duration-300';
        logoutLink.textContent = 'Odhlásiť sa';
        headerLinks.appendChild(logoutLink);
        logoutLink.addEventListener('click', handleLogout);

    } else {
        const loginLink = document.createElement('a');
        loginLink.href = '/login.html';
        loginLink.className = 'px-3 py-2 rounded-md text-sm font-medium hover:bg-white hover:text-gray-900 transition-colors duration-300';
        loginLink.textContent = 'Prihlásenie';
        headerLinks.appendChild(loginLink);
    }
};

/**
 * Aktualizuje viditeľnosť odkazu na registráciu na základe nastavenia v databáze a aktuálneho času.
 * @param {object} registrationData - Dáta o stave registrácie z Firestore.
 */
const updateRegistrationLinkVisibility = (registrationData) => {
    const registrationLink = document.getElementById('registration-link');

    if (!registrationLink || !registrationData) {
        return;
    }

    const now = new Date();
    const openDate = registrationData.open?.toDate();
    const closeDate = registrationData.close?.toDate();
    const isRegistrationOpen = now >= openDate && now <= closeDate;
    
    if (isRegistrationOpen) {
        registrationLink.classList.remove('hidden');
    } else {
        registrationLink.classList.add('hidden');
    }
};

/**
 * Počúva na zmeny v dokumentoch Firestore a aktualizuje stav registrácie a notifikácie.
 */
const setupFirestoreListeners = () => {
    try {
        if (!window.db) {
            console.warn("header.js: Firestore databáza nie je inicializovaná.");
            return;
        }

        // Listener pre zmeny v dokumente 'registration'
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (doc) => {
            if (doc.exists()) {
                const registrationData = doc.data();
                updateRegistrationLinkVisibility(registrationData);
                // Nastavenie intervalu pre kontrolu
                if (registrationCheckIntervalId) {
                    clearInterval(registrationCheckIntervalId);
                }
                // Každú minútu preverí, či sa nezmenil stav registrácie
                registrationCheckIntervalId = setInterval(() => {
                    updateRegistrationLinkVisibility(registrationData);
                }, 60000); // 60 000 ms = 1 minúta
            } else {
                console.warn("header.js: Dokument 'settings/registration' neexistuje.");
            }
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dokumentu 'registration':", error);
        });

        // Listener pre notifikácie
        const notificationsCollectionRef = collection(window.db, "notifications");
        // Na začiatku nastavíme flag, aby sme ignorovali prvotné načítanie
        let isFirstLoadNotifications = true;
        onSnapshot(notificationsCollectionRef, (querySnapshot) => {
            // Po prvom načítaní nastavíme flag na false
            if (isFirstLoadNotifications) {
                isFirstLoadNotifications = false;
                return;
            }
            
            querySnapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const newNotification = change.doc.data();
                    console.log("header.js: Nová notifikácia prijatá:", newNotification);
                    // Zobrazíme notifikáciu, ak je používateľ admin a má zapnuté notifikácie
                    if (window.globalUserProfileData?.role === 'admin' && window.globalUserProfileData?.displayNotifications) {
                        const message = newNotification.changes.join(', ');
                        showAdminNotification(message);
                    }
                }
            });
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní notifikácií:", error);
        });

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii listenerov Firestore:", error);
    }
};

/**
 * Globálna funkcia pre načítanie a inicializáciu hlavičky
 */
window.loadHeaderAndScripts = async (userProfileData) => {
    try {
        // Kontrola, či už bola hlavička inicializovaná
        if (headerInitialized) {
            console.log("header.js: Hlavička už bola inicializovaná, aktualizujem len odkazy.");
            updateHeaderLinks(userProfileData);
            return;
        }

        const headerPlaceholder = document.getElementById('header-placeholder');
        if (!headerPlaceholder) {
            return;
        }
        
        const response = await fetch('/header.html');
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        
        headerPlaceholder.innerHTML = headerHtml;

        // Po načítaní hlavičky pridáme event listener na tlačidlo odhlásenia
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }
        
        // Nastavíme listenery pre Firestore
        setupFirestoreListeners();

        // Aktualizujeme odkazy, pretože dáta sú už k dispozícii
        updateHeaderLinks(userProfileData);

        headerInitialized = true;

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

// Zaregistrujeme poslucháča udalosti 'globalDataUpdated' a spustíme inicializáciu hlavičky.
window.addEventListener('globalDataUpdated', (event) => {
    console.log('header.js: Prijatá udalosť "globalDataUpdated". Spúšťam inicializáciu hlavičky.');
    window.loadHeaderAndScripts(event.detail);
});

// Ak sú dáta už dostupné (napríklad pri opätovnom načítaní stránky), spustíme inicializáciu ihneď.
if (window.globalUserProfileData) {
    console.log("header.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.");
    window.loadHeaderAndScripts(window.globalUserProfileData);
}
