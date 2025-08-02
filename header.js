// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Je prispôsobený na spoluprácu s aktualizovaným authentication.js.

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
    notificationElement.innerHTML = `
        <div class="flex-shrink-0">
            <!-- Ikony pre notifikácie -->
            ${type === 'success' ? '<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' : '<svg class="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>'}
        </div>
        <div>${message}</div>
    `;
    notificationElement.className = `${notificationElement.className.replace(/bg-\w+-\d+/g, '')} ${bgColor} opacity-100 pointer-events-auto`;

    // Skryjeme notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.className = notificationElement.className.replace('opacity-100 pointer-events-auto', 'opacity-0 pointer-events-none');
    }, 5000);
};

// Funkcia na odhlásenie
const handleLogout = async () => {
    try {
        await window.auth.signOut();
        // Presmerovanie na domovskú stránku po úspešnom odhlásení
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Chyba pri odhlasovaní:", error);
        window.showGlobalNotification('Chyba pri odhlasovaní. Skúste to prosím znova.', 'error');
    }
};

/**
 * Dynamicky upraví navigačné odkazy na základe stavu autentifikácie používateľa.
 * @param {object|null} userProfileData - Objekt s dátami profilu používateľa, alebo null.
 */
const updateHeaderLinks = (userProfileData) => {
    const header = document.querySelector('header');
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');
    
    // Predvolená farba hlavičky, ak používateľ nie je prihlásený
    const defaultColor = '#1d4ed8';

    // Skryjeme všetky odkazy na začiatku
    if (authLink) authLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'none';
    if (logoutButton) logoutButton.style.display = 'none';
    if (registerLink) registerLink.style.display = 'none';

    // Ak je používateľ prihlásený
    if (userProfileData) {
        if (profileLink) profileLink.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'block';

        // Zmena farby hlavičky na základe roly
        let roleColor = defaultColor;
        switch (userProfileData.role) {
            case 'admin':
                roleColor = '#47b3ff';
                break;
            case 'hall':
                roleColor = '#b06835';
                break;
            case 'user':
                roleColor = '#9333EA';
                break;
            default:
                roleColor = defaultColor;
                break;
        }
        if (header) {
             header.style.backgroundColor = roleColor;
        }

    } else { // Ak nie je prihlásený
        if (authLink) authLink.style.display = 'block';
        if (header) {
            header.style.backgroundColor = defaultColor;
        }
    }
    
    // Po nastavení všetkých vlastností zviditeľníme hlavičku
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        headerPlaceholder.classList.remove('invisible');
    }
};

// Funkcia na načítanie a inicializáciu hlavičky
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

        // Pre prípad, že authentication.js už vyslalo udalosť pred pripojením listenera,
        // zavoláme funkciu raz hneď po načítaní.
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
