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

    // Zobrazenie notifikácie a jej skrytie po 3 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-0', 'pointer-events-none');
        notificationElement.classList.add('opacity-100');
    }, 10);
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100');
        notificationElement.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
};


// Funkcia pre odhlásenie
const handleLogout = async () => {
    if (window.auth) {
        await window.auth.signOut();
        window.location.href = 'index.html'; // Presmerovanie po odhlásení
        window.showGlobalNotification('Boli ste úspešne odhlásený.', 'success');
    } else {
        console.error('header.js: Firebase Auth inštancia nie je dostupná.');
        window.showGlobalNotification('Chyba pri odhlasovaní.', 'error');
    }
};

// Funkcia, ktorá dynamicky mení navigačné odkazy na základe stavu prihlásenia
const updateHeaderLinks = (userProfileData) => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const registerLink = document.getElementById('register-link');
    const header = document.querySelector('header');

    // Skryť všetky odkazy ako prvé
    if (authLink) authLink.classList.add('hidden');
    if (profileLink) profileLink.classList.add('hidden');
    if (logoutButton) logoutButton.classList.add('hidden');
    if (registerLink) registerLink.classList.add('hidden');
    
    // Odstránenie všetkých tried farieb pred nastavením novej
    if (header) {
        header.classList.remove('bg-blue-700', 'bg-[#9333EA]', 'bg-[#b06835]', 'bg-[#1D4ED8]');
    }

    if (userProfileData) {
        // Používateľ je prihlásený
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');

        // Nastavíme farbu hlavičky na základe typu používateľa
        if (userProfileData.type === 'user') {
            header.classList.add('bg-[#9333EA]'); // Tmavá fialová pre používateľa
            if (registerLink) {
                 registerLink.classList.remove('hidden');
                 registerLink.textContent = 'Registrácia na turnaj';
                 registerLink.href = 'logged-in-registration.html';
             }
        } else if (userProfileData.type === 'admin') {
            header.classList.add('bg-[#1D4ED8]'); // Tmavá modrá pre admina
            if (registerLink) {
                 registerLink.classList.remove('hidden');
                 registerLink.textContent = 'Správa registrácií';
                 registerLink.href = 'admin.html';
             }
        } else if (userProfileData.type === 'hall') {
            header.classList.add('bg-[#b06835]'); // Oranžová farba pre halu
            if (registerLink) {
                registerLink.classList.add('hidden'); // Skryť pre halu
            }
        } else {
            // Predvolená farba pre iné typy alebo neznámy stav prihlásenia
            header.classList.add('bg-blue-700');
        }

    } else {
        // Používateľ nie je prihlásený
        if (authLink) authLink.classList.remove('hidden');
        if (header) {
             header.classList.add('bg-blue-700');
        }
    }
};

// Funkcia na načítanie hlavičky a nastavenie listenerov
const loadHeader = async () => {
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
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
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

// Spustíme načítanie hlavičky pri načítaní DOM
window.addEventListener('DOMContentLoaded', loadHeader);
