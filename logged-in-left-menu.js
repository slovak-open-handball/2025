// logged-in-left-menu.js
// Tento súbor spravuje logiku pre ľavé menu, vrátane jeho rozbalenia/zbalenia
// a obsluhy udalostí pri kliknutí a prechode myšou.

// Funkcia, ktorá sa spustí po načítaní HTML obsahu menu
const setupMenuListeners = () => {
    const leftMenu = document.getElementById('left-menu');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const menuTexts = document.querySelectorAll('#left-menu .group-hover\\:opacity-100');

    if (leftMenu && menuToggleButton && menuTexts.length > 0) {
        let isMenuToggled = false;

        // Funkcia pre prepínanie tried, ktorá zmení šírku menu
        const toggleMenu = () => {
            isMenuToggled = !isMenuToggled;
            console.log(`left-menu.js: Prepínam menu. Stav: ${isMenuToggled}`);
            if (isMenuToggled) {
                leftMenu.classList.remove('w-16', 'hover:w-64', 'group');
                leftMenu.classList.add('w-64', 'is-toggled');
                // Zabezpečíme viditeľnosť textov po kliknutí
                menuTexts.forEach(text => {
                    text.classList.remove('opacity-0');
                    text.classList.add('opacity-100');
                });
            } else {
                leftMenu.classList.remove('w-64', 'is-toggled');
                leftMenu.classList.add('w-16', 'hover:w-64', 'group');
                // Skryjeme texty, aby sa zobrazovali len pri hoveri
                menuTexts.forEach(text => {
                    text.classList.remove('opacity-100');
                    text.classList.add('opacity-0');
                });
            }
        };

        // Event listener pre kliknutie na tlačidlo
        menuToggleButton.addEventListener('click', toggleMenu);

        console.log("left-menu.js: Listener pre tlačidlo prepínania menu bol pridaný.");
    } else {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button alebo textové elementy po vložení HTML.");
    }
}

// Hlavná funkcia na načítanie menu
window.loadLeftMenu = async () => {
    console.log("left-menu.js: Spúšťam funkciu loadLeftMenu.");

    // Kontrola existencie globálnych používateľských dát
    if (window.globalUserProfileData) {
        try {
            const menuPlaceholder = document.getElementById('left-menu-placeholder');
            if (!menuPlaceholder) {
                console.error("left-menu.js: Nepodarilo sa nájsť element s id 'left-menu-placeholder'.");
                return;
            }

            console.log("left-menu.js: Placeholder pre menu bol nájdený. Načítavam HTML...");
            const response = await fetch('logged-in-left-menu.html');
            if (!response.ok) {
                throw new Error(`Chyba pri načítaní logged-in-left-menu.html: ${response.status} ${response.statusText}`);
            }
            const menuHtml = await response.text();
            menuPlaceholder.innerHTML = menuHtml;
            console.log("left-menu.js: Obsah menu bol úspešne vložený do placeholderu.");

            // Po úspešnom vložení HTML hneď nastavíme poslucháčov
            setupMenuListeners();

        } catch (error) {
            console.error("left-menu.js: Chyba pri inicializácii ľavého menu:", error);
        }
    } else {
        console.log("left-menu.js: Globálne dáta používateľa nie sú dostupné. Menu sa nenačíta.");
    }
};

// Spustenie načítania ľavého menu po načítaní DOM
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadLeftMenu);
} else {
    window.loadLeftMenu();
}
