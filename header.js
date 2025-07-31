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
    notificationElement.className = notificationElement.className.replace(/bg-.*?(?=\s|$)/, '') + ` ${bgColorClass}`;
    
    // Vytvoríme ikonku na základe typu notifikácie
    const icon = type === 'success' ? `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ` : `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    `;
    
    // Nastavíme HTML obsah notifikácie
    notificationElement.innerHTML = `${icon}<span>${message}</span>`;
    
    // Zobrazíme notifikáciu (nastavíme opacitu na 1 a posunieme ju nadol)
    notificationElement.classList.remove('opacity-0', '-translate-y-full');
    notificationElement.classList.add('opacity-100', 'translate-y-0');

    // Po 3 sekundách notifikáciu skryjeme
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'translate-y-0');
        notificationElement.classList.add('opacity-0', '-translate-y-full');
    }, 3000);
};

// Funkcia na načítanie hlavičky (len HTML štruktúry)
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const headerHtml = await response.text();
        const headerPlaceholder = document.getElementById('header-placeholder');
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        } else {
            console.error("header.js: Nenašiel sa '#header-placeholder' element.");
        }
    } catch (error) {
        console.error("header.js: Chyba pri načítaní hlavičky:", error);
    }
}

// Funkcia pre odhlásenie
const handleLogout = async () => {
    if (window.auth) {
        try {
            await window.auth.signOut();
            // Teraz voláme globálnu funkciu, ktorá už existuje
            window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
            // Teraz voláme globálnu funkciu, ktorá už existuje
            window.showGlobalNotification('Chyba pri odhlasovaní. Skúste znova.', 'error');
        }
    }
};

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks() {
    console.log("header.js: Aktualizujem odkazy v hlavičke.");
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const registerLink = document.getElementById('register-link');
    const logoutButton = document.getElementById('logout-button');

    // Zabezpečíme, že všetky prvky existujú pred manipuláciou
    if (!profileLink || !authLink || !registerLink || !logoutButton) {
        console.error("header.js: Chýba jeden alebo viac navigačných odkazov v DOM.");
        return;
    }

    if (window.globalUserProfileData) {
        // Prihlásený používateľ
        profileLink.classList.remove('hidden'); // Zobraziť 'Moja zóna'
        authLink.classList.add('hidden');      // Skryť 'Prihlásenie'
        registerLink.classList.add('hidden');   // Skryť 'Registrácia na turnaj'
        logoutButton.classList.remove('hidden');  // Zobraziť 'Odhlásiť'
    } else {
        // Odhlásený používateľ
        profileLink.classList.add('hidden');      // Skryť 'Moja zóna'
        authLink.classList.remove('hidden');      // Zobraziť 'Prihlásenie'
        registerLink.classList.add('hidden');   // Skryť 'Registrácia na turnaj'
        logoutButton.classList.add('hidden');   // Skryť 'Odhlásiť'
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

        // Nastavíme listener na zmeny v globalUserProfileData, ktoré indikujú zmeny stavu prihlásenia
        // Toto zabezpečí, že sa odkazy aktualizujú, hneď ako je používateľ prihlásený/odhlásený
        Object.defineProperty(window, 'globalUserProfileData', {
            set: function(value) {
                this._globalUserProfileData = value;
                updateHeaderLinks(); // Volať funkciu na aktualizáciu vždy, keď sa dáta zmenia
            },
            get: function() {
                return this._globalUserProfileData;
            }
        });

        // Zavolajte funkciu na aktualizáciu hneď po inicializácii pre prvý stav
        updateHeaderLinks();

    }).catch(error => {
        console.error("header.js: Chyba pri inicializácii hlavičky a listenerov:", error);
    });
};
