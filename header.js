// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Bol upravený tak, aby reagoval na zmeny v dátach registrácie a kategórií v reálnom čase,
// a zároveň aby pravidelne kontroloval aktuálny čas, aby sa odkaz zobrazil alebo skryl
// presne v momente, keď sa prekročí dátum otvorenia alebo uzavretia registrácie.

// Importy pre potrebné Firebase funkcie
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Globálna premenná na uloženie ID intervalu, aby sme ho mohli neskôr zrušiť
let registrationCheckIntervalId = null;

// Globálna funkcia pre zobrazenie notifikácií
// Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    
    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a pozicovanie
        notificationElement.className = `
            fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
            p-4 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ease-in-out
            flex items-center space-x-2
            opacity-0 pointer-events-none
        `;
        document.body.appendChild(notificationElement);
    }

    // Nastavíme obsah a farbu na základe typu notifikácie
    // Pre úspech použijeme farbu #3A8D41, pre chybu červenú
    const bgColor = type === 'success' ? 'bg-[#3A8D41]' : 'bg-red-600';
    notificationElement.className = notificationElement.className.replace(/bg-[\w-]+/, bgColor);
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${type === 'success' 
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'}
        </svg>
        <span>${message}</span>
    `;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'pointer-events-auto');
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'pointer-events-auto');
    }, 5000);
};

/**
 * Funkcia na odhlásenie používateľa
 */
const handleLogout = async () => {
    try {
        const auth = getAuth();
        await signOut(auth);
        console.log("header.js: Používateľ bol úspešne odhlásený.");
        window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
        // Presmerovanie na domovskú stránku po odhlásení
        window.location.href = 'index.html';
    } catch (error) {
        console.error("header.js: Chyba pri odhlásení:", error);
        window.showGlobalNotification('Chyba pri odhlásení. Skúste to znova.', 'error');
    }
};

/**
 * Funkcia, ktorá vráti farbu hlavičky na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user').
 * @returns {string} Hex kód farby.
 */
const getHeaderColorByRole = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff'; // Farba pre admina
        case 'hall':
            return '#b06835'; // Farba pre halu
        case 'user':
            return '#9333EA'; // Farba pre bežného používateľa
        default:
            return '#1D4ED8'; // Predvolená farba (bg-blue-800)
    }
}

/**
 * Funkcia na aktualizáciu viditeľnosti odkazov a farby hlavičky na základe stavu autentifikácie.
 * Táto funkcia tiež kontroluje, či sú načítané všetky potrebné dáta, a až potom zruší triedu "invisible".
 * @param {object} userProfileData - Dáta profilu používateľa.
 */
const updateHeaderLinks = (userProfileData) => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const headerElement = document.querySelector('header');
    
    if (!authLink || !profileLink || !logoutButton || !headerElement) {
        console.error("header.js: Niektoré elementy hlavičky neboli nájdené.");
        return;
    }

    // Až keď sú všetky dáta načítané, vykonáme zmeny
    if (window.isGlobalAuthReady && window.registrationDates && window.hasCategories !== null) {
        if (userProfileData) {
            // Používateľ je prihlásený
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            // Nastavíme farbu hlavičky podľa roly
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);
        } else {
            // Používateľ nie je prihlásený
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            // Nastavíme predvolenú farbu
            headerElement.style.backgroundColor = getHeaderColorByRole(null);
        }

        // Aktualizujeme viditeľnosť odkazu na registráciu
        updateRegistrationLinkVisibility(userProfileData);

        // Hlavička sa stane viditeľnou LEN ak sú všetky dáta načítané
        headerElement.classList.remove('invisible');
    }
};

/**
 * Funkcia na aktualizáciu viditeľnosti odkazu "Registrácia na turnaj" na základe
 * aktuálneho dátumu a existencie kategórií.
 * Odkaz sa zobrazí len vtedy, ak obe podmienky platia súčasne.
 * @param {object} userProfileData - Dáta profilu používateľa.
 */
const updateRegistrationLinkVisibility = (userProfileData) => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    // Podmienka: Musí byť otvorená registrácia (aktuálny dátum v rozmedzí) A zároveň musia existovať kategórie.
    const isRegistrationOpen = window.registrationDates && new Date() >= window.registrationDates.registrationStartDate.toDate() && new Date() <= window.registrationDates.registrationEndDate.toDate();
    const hasCategories = window.hasCategories;

    if (isRegistrationOpen && hasCategories) {
        registerLink.classList.remove('hidden');
        // Nastavíme správny href v závislosti od prihlásenia
        if (userProfileData) {
            registerLink.href = 'logged-in-registration.html';
        } else {
            registerLink.href = 'register.html';
        }
    } else {
        registerLink.classList.add('hidden');
    }
};

// Počúva na zmeny v dokumentoch Firestore a aktualizuje stav registrácie
const setupFirestoreListeners = () => {
    try {
        if (!window.db) {
            console.warn("header.js: Firestore databáza nie je inicializovaná.");
            return;
        }

        // Listener pre registračné dáta
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
                console.log("header.js: Dáta o registrácii aktualizované (onSnapshot).", window.registrationDates);
            } else {
                window.registrationDates = null;
                console.warn("header.js: Dokument 'settings/registration' nebol nájdený!");
            }
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dát o registrácii:", error);
        });

        // Listener pre kategórie
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const categories = docSnap.data();
                window.hasCategories = Object.keys(categories).length > 0;
                console.log(`header.js: Dáta kategórií aktualizované (onSnapshot). Počet kategórií: ${Object.keys(categories).length}`);
            } else {
                window.hasCategories = false;
                console.warn("header.js: Dokument 'settings/categories' nebol nájdený!");
            }
            updateHeaderLinks(window.globalUserProfileData);
        }, (error) => {
            console.error("header.js: Chyba pri počúvaní dát o kategóriách:", error);
        });

        // Spustíme časovač, ktorý každú sekundu kontroluje aktuálny čas a aktualizuje viditeľnosť odkazu
        if (registrationCheckIntervalId) {
            clearInterval(registrationCheckIntervalId);
        }
        registrationCheckIntervalId = setInterval(() => {
            // Kontrola beží každú sekundu, ale len ak máme potrebné dáta
            if (window.registrationDates) {
                updateRegistrationLinkVisibility(window.globalUserProfileData);
            }
        }, 1000); // 1000 ms = 1 sekunda
        console.log("header.js: Časovač pre kontrolu registrácie spustený.");
        
        // Zabezpečíme, že sa časovač zruší, keď používateľ opustí stránku
        window.addEventListener('beforeunload', () => {
            if (registrationCheckIntervalId) {
                clearInterval(registrationCheckIntervalId);
                console.log("header.js: Časovač pre kontrolu registrácie zrušený.");
            }
        });

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii listenerov Firestore:", error);
    }
};

/**
 * Hlavná funkcia na načítanie hlavičky a pripojenie skriptov.
 * Načítava header.html a vkladá ho do placeholderu.
 */
window.loadHeaderAndScripts = async () => {
    try {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const response = await fetch('header.html');
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        }

        // Po načítaní hlavičky pridáme event listener na tlačidlo odhlásenia
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }

        // Pridáme listener na udalosť, ktorú posiela 'authentication.js'
        window.addEventListener('globalDataUpdated', (event) => {
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
            updateHeaderLinks(window.globalUserProfileData);
        });

        // Nastavíme listenery pre Firestore hneď po inicializácii
        setupFirestoreListeners();

        // Zavoláme funkciu raz hneď po načítaní pre prípad, že authentication.js už vyslalo udalosť
        updateHeaderLinks(window.globalUserProfileData);

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

// Spustenie načítania hlavičky, ak DOM už bol načítaný
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}
