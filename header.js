// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.

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
    const bgColorClass = type === 'success' ? 'bg-[#3A8D41]' : 'bg-red-600';
    notificationElement.className = notificationElement.className.replace(/bg-\[#3A8D41\]|bg-red-600/, bgColorClass);
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${type === 'success'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'
            }
        </svg>
        <span>${message}</span>
    `;

    // Zobrazíme notifikáciu
    setTimeout(() => {
        notificationElement.classList.remove('opacity-0', 'pointer-events-none');
    }, 10);

    // Skryjeme notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.add('opacity-0', 'pointer-events-none');
    }, 5000);
};

// Funkcia, ktorá načíta HTML hlavičky pomocou fetch
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const headerHtml = await response.text();
        document.getElementById('header-placeholder').innerHTML = headerHtml;
        console.log("header.js: Hlavička bola úspešne načítaná a vložená.");
    } catch (e) {
        console.error("header.js: Chyba pri načítaní hlavičky:", e);
        document.getElementById('header-placeholder').innerHTML = '<header class="bg-red-600 text-white p-4 text-center">Chyba pri načítaní navigácie.</header>';
    }
}

// Funkcia pre odhlásenie
async function handleLogout() {
    if (window.auth) {
        try {
            await window.auth.signOut();
            window.showGlobalNotification('Boli ste úspešne odhlásený.', 'success');
            console.log("header.js: Používateľ odhlásený.");
            // Presmerovať na prihlasovaciu stránku alebo domov
            window.location.href = 'index.html'; 
        } catch (error) {
            console.error("header.js: Chyba pri odhlasovaní:", error);
            window.showGlobalNotification('Chyba pri odhlasovaní. Skúste to znova.', 'error');
        }
    }
}

// Funkcia, ktorá dynamicky mení odkazy v hlavičke na základe stavu autentifikácie
function updateHeaderLinks() {
    console.log("header.js: Spúšťam aktualizáciu odkazov hlavičky.");
    const homeLink = document.getElementById('home-link');
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');
    const header = document.querySelector('header');

    // Najprv skryjeme všetky odkazy
    const allLinks = [homeLink, authLink, profileLink, logoutButton, registerLink];
    allLinks.forEach(link => {
        if (link) {
            link.classList.add('hidden');
        }
    });

    const user = window.auth ? window.auth.currentUser : null;
    const userProfileData = window.globalUserProfileData;
    
    // Farba hlavičky sa zmení na základe typu používateľa
    if (header) {
        if (user && userProfileData && userProfileData.type === 'user') {
            header.classList.remove('bg-blue-700');
            header.classList.add('bg-[#9333EA]');
        } else {
            header.classList.remove('bg-[#9333EA]');
            header.classList.add('bg-blue-700');
        }
    }

    // Domov je vždy viditeľný
    if (homeLink) {
        homeLink.classList.remove('hidden');
    }

    if (user) {
        // Používateľ je prihlásený
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');

        // Podmienka pre zobrazenie "Registrácia na turnaj"
        if (userProfileData && userProfileData.type === 'user') {
            if (registerLink) {
                registerLink.classList.remove('hidden');
                registerLink.textContent = 'Registrácia na turnaj';
                registerLink.href = 'logged-in-registration.html';
            }
        }
    } else {
        // Používateľ je odhlásený
        if (authLink) authLink.classList.remove('hidden');
        
        // Zobraziť odkaz na registráciu pre všetkých, ale s iným textom a odkazom
        if (registerLink) {
            registerLink.classList.remove('hidden');
            registerLink.textContent = 'Registrovať sa';
            registerLink.href = 'registration.html';
        }
    }
}


// Načítať hlavičku HTML štruktúru ako prvú, potom nastaviť listenery
window.onload = function() {
    console.log("header.js: DOM bol načítaný.");
    
    // Načíta hlavičku a až potom nastaví listener a zaktualizuje odkazy
    loadHeader().then(() => {
        // Po načítaní hlavičky pridajte event listener na tlačidlo odhlásenia
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }

        // Nastavíme listener na vlastnú udalosť, ktorá signalizuje, že authentication.js
        // má pripravené globálne dáta. Toto zabezpečí správne načítanie farby hlavičky.
        window.addEventListener('globalDataUpdated', updateHeaderLinks);

        // Voláme funkciu aj raz na začiatku, ak už sú dáta pripravené (pre prípad race condition)
        // Používame globálny flag isGlobalAuthReady, ktorý nastavuje authentication.js
        if (window.isGlobalAuthReady) {
            updateHeaderLinks();
        }

    }).catch(error => {
        console.error("header.js: Chyba pri načítaní hlavičky alebo inicializácii:", error);
    });
};
