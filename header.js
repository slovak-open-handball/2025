// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Používa rovnakú logiku pre načítavanie dát ako logged-in-my-data.js,
// čím zabezpečuje konzistentnosť v celej aplikácii.

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
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    notificationElement.className = notificationElement.className.replace(/bg-red-600|bg-green-600/g, '') + ` ${bgColor}`;
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${type === 'success'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'
            }
        </svg>
        <span>${message}</span>
    `;

    // Zobrazenie notifikácie
    notificationElement.classList.remove('opacity-0', 'pointer-events-none');
    notificationElement.classList.add('opacity-100');

    // Skrytie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0', 'pointer-events-none');
    }, 5000);
};

// Funkcia na obsluhu odhlásenia používateľa
const handleLogout = async () => {
    // Používame globálnu premennú 'auth' z 'authentication.js'
    if (window.auth) {
        try {
            await window.auth.signOut();
            console.log("header.js: Používateľ bol úspešne odhlásený.");
            // Po úspešnom odhlásení presmerujeme na úvodnú stránku
            window.location.href = 'index.html';
        } catch (error) {
            console.error("header.js: Chyba pri odhlásení:", error);
            window.showGlobalNotification("Chyba pri odhlásení. Skúste to prosím znova.", 'error');
        }
    }
};

// Funkcia na dynamickú aktualizáciu navigačných odkazov
// Táto funkcia je volaná v 'authentication.js' a pri udalosti 'globalDataUpdated'
const updateHeaderLinks = (userProfileData) => {
    const homeLink = document.getElementById('home-link');
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');
    const header = document.querySelector('header');

    // Základná farba hlavičky pre neprihlásených
    let headerColor = '#1d4ed8'; // blue-700

    if (userProfileData) {
        // Používateľ je prihlásený
        authLink.classList.add('hidden');
        profileLink.classList.remove('hidden');
        logoutButton.classList.remove('hidden');

        // Podľa roly používateľa nastavíme farbu
        switch (userProfileData.role) {
            case 'admin':
                headerColor = '#47b3ff'; // admin
                break;
            case 'hall':
                headerColor = '#b06835'; // hall
                break;
            case 'user':
                headerColor = '#9333EA'; // user
                break;
            case 'null':
                headerColor = '#1d4ed8'; // null
                break;
        }
        
        // Zobrazí odkaz na registráciu len ak je používateľ prihlásený a má povolenú rolu
        if (userProfileData.role === 'admin' || userProfileData.role === 'hall' || userProfileData.role === 'user') {
            registerLink.classList.add('hidden');
        }

    } else {
        // Používateľ nie je prihlásený
        authLink.classList.remove('hidden');
        profileLink.classList.add('hidden');
        logoutButton.classList.add('hidden');
        registerLink.classList.add('hidden'); // Skryjeme registráciu pre neprihlásených
        headerColor = '#1d4ed8'; // blue-700
    }

    // Nastavenie farby pozadia hlavičky
    if (header) {
        header.style.backgroundColor = headerColor;
    }
};

// Funkcia na načítanie a inicializáciu hlavičky
const loadHeader = async () => {
    try {
        const response = await fetch('header.html');
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        document.getElementById('header-placeholder').innerHTML = headerHtml;

        // Po načítaní hlavičky pridáme event listener na tlačidlo odhlásenia
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }

        // Kľúčová časť: Pridáme listener na udalosť, ktorú posiela 'authentication.js'
        // Týmto sa zabezpečí, že hlavička sa aktualizuje, až keď sú dáta z databázy
        // načítané a globálna premenná 'globalUserProfileData' je dostupná.
        window.addEventListener('globalDataUpdated', (event) => {
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
            // Dáta prevezmeme z globálnej premennej
            updateHeaderLinks(window.globalUserProfileData);
        });

        // Zavoláme funkciu hneď po načítaní, pre prípad, že dáta boli načítané
        // pred pripojením listenera. Ak nie, listener to zachytí neskôr.
        updateHeaderLinks(window.globalUserProfileData);
        
    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

// Spustenie načítania hlavičky po načítaní DOM
document.addEventListener('DOMContentLoaded', loadHeader);
