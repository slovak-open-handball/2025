// header.js
// Tento skript spravuje dynamické zobrazovanie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Predpokladá, že header.html je vložený priamo do každej stránky.

// Funkcia pre odhlásenie
const handleLogout = async () => {
    if (window.auth) {
        try {
            await window.auth.signOut();
            window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
            // Presmerovanie po úspešnom odhlásení
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error("Chyba pri odhlasovaní:", error);
            window.showGlobalNotification('Chyba pri odhlasovaní. Skúste znova.', 'error');
        }
    } else {
        console.error("Firebase auth nie je dostupný.");
    }
};

// Funkcia na aktualizáciu stavu hlavičky
const updateHeaderState = () => {
    // Získanie referencií na navigačné prvky
    const registerLink = document.getElementById('register-link');
    const profileLink = document.getElementById('profile-link');
    const authLink = document.getElementById('auth-link');
    const logoutButton = document.getElementById('logout-button');

    // Inicializácia: všetky prvky skryjeme, aby sa predišlo preblikávaniu
    const allLinks = [registerLink, profileLink, authLink, logoutButton];
    allLinks.forEach(link => {
        if (link) link.classList.add('hidden');
    });

    // Kontrola, či je používateľ prihlásený
    // Používame globálne dáta, ktoré by mala nastaviť iná časť aplikácie
    if (window.globalUserProfileData && window.globalUserProfileData.isLoggedIn) {
        // Používateľ je prihlásený, zobrazíme odkazy pre prihláseného používateľa
        if (registerLink) registerLink.classList.remove('hidden');
        if (profileLink) profileLink.classList.remove('hidden');
        if (logoutButton) logoutButton.classList.remove('hidden');
    } else {
        // Používateľ nie je prihlásený, zobrazíme odkaz na prihlásenie
        if (authLink) authLink.classList.remove('hidden');
    }
};

// Počkáme na načítanie celého DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("header.js: DOM bol načítaný.");
    
    // Pridáme poslucháča pre tlačidlo odhlásenia
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
        console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
    }

    // Nastavíme listener na zmeny v globálnom stave, aby sa hlavička aktualizovala
    // pri prihlásení/odhlásení
    window.addEventListener('globalStateChanged', updateHeaderState);

    // Aktualizujeme stav hlavičky pri prvom načítaní
    updateHeaderState();
});

// Pomocná funkcia na zobrazenie globálnych notifikácií (pre lepšie UI)
window.showGlobalNotification = (message, type) => {
    // Táto funkcia by mala byť implementovaná vo vašom hlavnom JS
    // a spravovať zobrazenie notifikačných správ
    console.log(`[Notifikácia] ${type}: ${message}`);
};
