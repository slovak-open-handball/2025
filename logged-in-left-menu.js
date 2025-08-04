// logged-in-left-menu.js
// Tento súbor spravuje logiku pre ľavé menu, vrátane jeho rozbalenia/zbalenia
// a obsluhy udalostí pri kliknutí a prechode myšou.

window.loadLeftMenu = async () => {
    try {
        const menuPlaceholder = document.getElementById('left-menu-placeholder');
        if (!menuPlaceholder) {
            console.error("left-menu.js: Nepodarilo sa nájsť element s id 'left-menu-placeholder'.");
            return;
        }

        const response = await fetch('logged-in-left-menu.html');
        if (!response.ok) {
            throw new Error('Chyba pri načítaní logged-in-left-menu.html');
        }
        const menuHtml = await response.text();
        menuPlaceholder.innerHTML = menuHtml;

        const leftMenu = document.getElementById('left-menu');
        const menuToggleButton = document.getElementById('menu-toggle-button');

        if (leftMenu && menuToggleButton) {
            let isMenuToggled = false;

            // Funkcia pre prepínanie tried, ktorá zmení šírku menu
            const toggleMenu = () => {
                isMenuToggled = !isMenuToggled;
                if (isMenuToggled) {
                    leftMenu.classList.remove('w-16', 'hover:w-64', 'group');
                    leftMenu.classList.add('w-64');
                } else {
                    leftMenu.classList.remove('w-64');
                    leftMenu.classList.add('w-16', 'hover:w-64', 'group');
                }
            };

            // Event listener pre kliknutie na tlačidlo
            menuToggleButton.addEventListener('click', toggleMenu);

            console.log("left-menu.js: Listener pre tlačidlo prepínania menu bol pridaný.");
        }
    } catch (error) {
        console.error("left-menu.js: Chyba pri inicializácii ľavého menu:", error);
    }
};

// Spustenie načítania ľavého menu po načítaní DOM
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadLeftMenu);
} else {
    window.loadLeftMenu();
}
