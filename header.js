// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.

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
            window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
            window.showGlobalNotification('Chyba pri odhlasovaní. Skúste znova.', 'error');
        }
    }
};

// Funkcia na aktualizáciu viditeľnosti odkazov v hlavičke
function updateHeaderLinks() {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const registerLink = document.getElementById('register-link');
    const logoutButton = document.getElementById('logout-button');

    if (!authLink || !profileLink || !registerLink || !logoutButton) {
        console.error("header.js: Chýbajú niektoré navigačné prvky v DOM. Uistite sa, že súbor header.html bol načítaný.");
        return;
    }

    // Ak je používateľ prihlásený
    if (window.globalUserProfileData) {
        authLink.classList.add('hidden'); // Skryť 'Prihlásenie'
        profileLink.classList.remove('hidden'); // Zobraziť 'Moja zóna'
        logoutButton.classList.remove('hidden'); // Zobraziť 'Odhlásiť'
        
        // Ak má používateľ rolu 'admin' alebo 'player', zobrazí 'Registrácia'
        const userRole = window.globalUserProfileData.role;
        if (userRole === 'admin' || userRole === 'player') {
            registerLink.classList.remove('hidden');
        } else {
            registerLink.classList.add('hidden');
        }
    } else { // Ak je používateľ odhlásený
        authLink.classList.remove('hidden'); // Zobraziť 'Prihlásenie'
        profileLink.classList.add('hidden'); // Skryť 'Moja zóna'
        registerLink.classList.add('hidden'); // Skryť 'Registrácia na turnaj'
        logoutButton.classList.add('hidden'); // Skryť 'Odhlásiť'
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
        console.error("Chyba pri načítaní a inicializácii hlavičky:", error);
    });
};
