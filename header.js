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
    const icon = type === 'success' ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.5"></path><path d="M22 4L12 14.01l-3-3"></path></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-circle"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`;

    notificationElement.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] p-4 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ease-in-out flex items-center space-x-2 ${bgColor}`;
    notificationElement.innerHTML = `${icon}<span>${message}</span>`;
    
    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.style.opacity = '1';
        notificationElement.style.transform = 'translate(-50%, 0)';
    }, 100);

    // Automatické skrytie po 5 sekundách
    setTimeout(() => {
        notificationElement.style.opacity = '0';
        notificationElement.style.transform = 'translate(-50%, -20px)';
    }, 5000);
};

// Funkcia na aktualizáciu odkazov v hlavičke na základe stavu prihlásenia
const updateHeaderLinks = (userProfileData) => {
    const profileLink = document.getElementById('profile-link');
    const registerLink = document.getElementById('register-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    if (userProfileData) {
        // Používateľ je prihlásený
        profileLink.classList.remove('hidden');
        registerLink.classList.remove('hidden');
        authLink.classList.add('hidden');
        logoutButton.classList.remove('hidden');
    } else {
        // Používateľ je odhlásený
        profileLink.classList.add('hidden');
        registerLink.classList.add('hidden');
        authLink.classList.remove('hidden');
        logoutButton.classList.add('hidden');
    }
};

// Funkcia na spracovanie odhlásenia
const handleLogout = async () => {
    // Používame globálnu inštanciu auth
    if (window.auth) {
        try {
            await window.auth.signOut();
            window.location.href = 'index.html'; // Presmerovanie na domovskú stránku po odhlásení
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
            // Ak je k dispozícii globálna funkcia, použijeme ju
            if (window.showGlobalNotification) {
                window.showGlobalNotification('Nepodarilo sa odhlásiť. Skúste to prosím znova.', 'error');
            }
        }
    }
};


// Načítanie a inicializácia hlavičky
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
            // Dáta prevezmeme z event.detail
            updateHeaderLinks(window.globalUserProfileData);
        });

        // Zavoláme funkciu hneď po načítaní, pre prípad, že dáta boli načítané
        // pred pripojením listenera. Ak nie, listener to zachytí neskôr.
        // Spoliehame sa na globálnu premennú len pre počiatočné volanie
        updateHeaderLinks(window.globalUserProfileData);
        
    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

window.addEventListener('DOMContentLoaded', loadHeader);
