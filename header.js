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
    const bgColorClass = type === 'success' ? 'bg-[#3A8D41]' : 'bg-red-600';
    notificationElement.className = notificationElement.className.replace(/bg-\[#3A8D41\]|bg-red-600/g, '') + ` ${bgColorClass}`;
    notificationElement.innerHTML = `<span>${message}</span>`;
    
    // Zobrazíme notifikáciu a po 5 sekundách ju skryjeme
    notificationElement.classList.remove('opacity-0', 'pointer-events-none');
    notificationElement.classList.add('opacity-100');

    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0', 'pointer-events-none');
    }, 5000);
};


// Funkcia pre aktualizáciu navigačných odkazov na základe stavu používateľa a roly
const updateHeaderLinks = (userProfileData) => {
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');
    const profileLink = document.getElementById('profile-link');
    const registerLink = document.getElementById('register-link');
    const header = document.querySelector('header');

    if (!header) {
        console.error("Header element not found.");
        return;
    }

    // Odstránime všetky triedy s farbou pozadia, aby sme predišli duplikátom
    header.classList.remove('bg-blue-700', 'bg-red-700', 'bg-green-700');

    if (userProfileData) {
        // Používateľ je prihlásený
        if (authLink) authLink.classList.add('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');
        if (profileLink) profileLink.classList.remove('hidden');
        if (registerLink) registerLink.classList.remove('hidden');

        // Nastavíme farbu hlavičky podľa roly
        switch (userProfileData.role) {
            case 'admin':
                header.classList.add('bg-red-700');
                break;
            case 'hall':
                header.classList.add('bg-green-700');
                break;
            case 'user':
            default:
                header.classList.add('bg-blue-700');
                break;
        }

    } else {
        // Používateľ nie je prihlásený
        if (authLink) authLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.add('hidden');
        if (profileLink) profileLink.classList.add('hidden');
        if (registerLink) registerLink.classList.add('hidden');
        
        // Predvolená farba pre neprihlásených používateľov
        header.classList.add('bg-blue-700');
    }
};

// Funkcia na asynchrónne načítanie hlavičky
window.loadHeader = async () => {
    try {
        // Načítanie hlavičky HTML
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
            console.log('header.js: Prijatá udalosť \"globalDataUpdated\". Aktualizujem hlavičku.');
            // Dáta prevezmeme z event.detail
            updateHeaderLinks(event.detail);
        });

        // Zavoláme funkciu hneď po načítaní, pre prípad, že dáta boli načítané
        // pred pripojením listenera. Ak nie, listener to zachytí neskôr.
        // Spoliehame sa na globálnu premennú len pre počiatočné volanie
        updateHeaderLinks(window.globalUserProfileData);
        
    } catch (error) {
        console.error('header.js: Chyba pri načítaní hlavičky:', error);
    }
};

// Spustíme načítanie hlavičky po načítaní DOM
window.addEventListener('DOMContentLoaded', loadHeader);
