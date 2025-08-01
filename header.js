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
    notificationElement.className = notificationElement.className.replace(/bg-\[#[a-fA-F0-9]{6}\]|bg-red-600/, bgColorClass);
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
    requestAnimationFrame(() => {
        notificationElement.classList.remove('opacity-0', 'pointer-events-none');
        notificationElement.classList.add('opacity-100', 'pointer-events-auto');
    });

    // Skryjeme notifikáciu po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'pointer-events-auto');
        notificationElement.classList.add('opacity-0', 'pointer-events-none');
    }, 5000);
};

// Obsluha odhlásenia
const handleLogout = async () => {
    try {
        await window.auth.signOut();
        console.log('header.js: Používateľ bol úspešne odhlásený.');
        window.showGlobalNotification('Boli ste úspešne odhlásený.', 'success');
        // Presmerovanie na hlavnú stránku alebo na prihlasovaciu stránku
        window.location.href = 'index.html';
    } catch (error) {
        console.error('header.js: Chyba pri odhlasovaní:', error);
        window.showGlobalNotification('Chyba pri odhlasovaní. Skúste to prosím znova.', 'error');
    }
};

// Funkcia, ktorá dynamicky mení zobrazenie odkazov v hlavičke na základe stavu prihlásenia
const updateHeaderLinks = (userProfileData) => {
    // Definujeme odkazy
    const homeLink = document.getElementById('home-link');
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');
    const header = document.querySelector('header');

    // Nastavenie farby hlavičky na základe roly
    if (header) {
        let color = '#1D4ED8'; // Predvolená farba (#1D4ED8 je ekvivalent bg-blue-800, ale user chce default)
        if (userProfileData && userProfileData.role) {
            switch (userProfileData.role) {
                case 'admin':
                    color = '#47b3ff';
                    break;
                case 'hall':
                    color = '#b06835';
                    break;
                case 'user':
                    color = '#9333EA';
                    break;
                default:
                    // Predvolená farba už je nastavená
                    break;
            }
        }
        header.style.backgroundColor = color;
    }

    // Nastavenie viditeľnosti odkazov
    if (userProfileData) {
        // Používateľ je prihlásený
        homeLink?.classList.remove('hidden');
        profileLink?.classList.remove('hidden');
        logoutButton?.classList.remove('hidden');
        authLink?.classList.add('hidden');
        // Zobrazíme registráciu iba, ak je používateľ "user" a schválený
        if (userProfileData.role === 'user' && userProfileData.approved) {
            registerLink?.classList.remove('hidden');
        } else {
            registerLink?.classList.add('hidden');
        }
    } else {
        // Používateľ je odhlásený
        homeLink?.classList.remove('hidden');
        authLink?.classList.remove('hidden');
        registerLink?.classList.add('hidden');
        profileLink?.classList.add('hidden');
        logoutButton?.classList.add('hidden');
    }
};

// Funkcia na asynchrónne načítanie hlavičky a nastavenie listenerov
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
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
            // Dáta prevezmeme z event.detail
            updateHeaderLinks(window.globalUserProfileData);
        });

        // Zavoláme funkciu hneď po načítaní, pre prípad, že dáta boli načítané
        // pred pripojením listenera. Ak nie, listener to zachytí neskôr.
        // Spoliehame sa na globálnu premennú len pre počiatočné volanie
        updateHeaderLinks(window.globalUserProfileData);
        
    } catch (error) {
        console.error('header.js: Chyba pri načítaní hlavičky:', error);
    }
};
