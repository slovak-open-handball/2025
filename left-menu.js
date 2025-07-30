// Tento súbor už nenačítava Firebase ani nevykonáva autentifikáciu.
// Spolieha sa na to, že Firebase je inicializované a používateľ je prihlásený v hlavnej aplikácii.

// Funkcia na zvýraznenie aktívnej položky menu
function highlightActiveMenuItem() {
    // Odstránime zvýraznenie a triedy pre neklikateľnosť zo všetkých predtým aktívnych položiek
    const allMenuItems = document.querySelectorAll('.w-64 a');
    allMenuItems.forEach(item => {
        item.classList.remove('bg-blue-600', 'font-bold', 'text-white', 'cursor-default', 'pointer-events-none');
        item.classList.add('hover:bg-blue-600'); // Vrátime hover efekt
    });

    // Získame aktuálnu cestu URL (napr. /logged-in-my-data.html)
    const currentPath = window.location.pathname;
    // Získame len názov súboru (napr. logged-in-my-data)
    const currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);

    // Nájdeme odkaz v menu, ktorého href atribút končí aktuálnou stránkou
    const activeLink = document.querySelector(`.w-64 a[href$="${currentPage}"]`);
    const menuToggleIcon = document.getElementById('menu-toggle-icon');
    const leftMenuNav = document.getElementById('left-menu-nav'); // Získame nav element

    if (menuToggleIcon && leftMenuNav) {
        // NOVINKA: Vždy nastavíme farbu ikonky na bielu pre lepšiu viditeľnosť na tmavom pozadí menu
        menuToggleIcon.style.color = 'white';
    }

    if (activeLink) {
        // Zvýrazníme aktívnu položku a pridáme triedy pre neklikateľnosť
        activeLink.classList.remove('hover:bg-blue-600'); // Odstránime hover, aby sa nekolidoval so zvýraznením
        activeLink.classList.add('bg-blue-600', 'font-bold', 'text-white', 'cursor-default', 'pointer-events-none'); // Pridáme triedy pre zvýraznenie a neklikateľnosť
    }
}


// Funkcia na načítanie obsahu do hlavnej oblasti
// Táto funkcia by mala byť volaná z hlavnej React aplikácie (MyDataApp)
// na dynamické načítanie rôznych sub-komponentov/stránok do #root divu.
// Už nenačítava celé HTML súbory, ale iba ich zodpovedajúce JS súbory s React komponentmi.
async function loadContent(jsFileName) { // ZMENA: Očakáva názov JS súboru bez .js prípony
    const contentArea = document.getElementById('main-content-area');
    if (!contentArea) {
        console.error("Element s ID 'main-content-area' nebol nájdený.");
        return;
    }

    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error("Element s ID 'root' nebol nájdený.");
        return;
    }

    // Vyčistíme starý obsah Reactu
    if (rootElement._reactRootContainer) { // Kontrola existencie React 18 root kontajnera
        rootElement._reactRootContainer.unmount();
    }
    rootElement.innerHTML = '<div class="flex items-center justify-center h-full text-xl text-gray-700">Načítavam...</div>';

    try {
        // Dynamicky načítať JS súbor s React komponentom
        const scriptElement = document.createElement('script');
        scriptElement.src = `${jsFileName}.js`;
        
        // Zabezpečíme, aby sa skript načítal len raz
        scriptElement.onload = () => {
            let rootComponent = null;
            // Určiť, ktorý React komponent sa má vykresliť na základe jsFileName
            if (jsFileName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                rootComponent = MyDataApp;
            } else if (jsFileName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
                rootComponent = ChangeNameApp;
            } else if (jsFileName === 'logged-in-change-phone' && typeof ChangePhoneApp !== 'undefined') {
                rootComponent = ChangePhoneApp;
            } else if (jsFileName === 'logged-in-email' && typeof ChangeEmailApp !== 'undefined') {
                rootComponent = ChangeEmailApp;
            } else if (jsFileName === 'logged-in-change-password' && typeof ChangePasswordApp !== 'undefined') {
                rootComponent = ChangePasswordApp;
            } else if (jsFileName === 'logged-in-change-billing-data' && typeof ChangeBillingDataApp !== 'undefined') { // Opravený názov komponentu
                rootComponent = ChangeBillingDataApp;
            } else if (jsFileName === 'logged-in-my-settings' && typeof MySettingsApp !== 'undefined') {
                rootComponent = MySettingsApp;
            } else if (jsFileName === 'logged-in-notifications' && typeof NotificationsApp !== 'undefined') {
                rootComponent = NotificationsApp;
            } else if (jsFileName === 'logged-in-soh-chat' && typeof SohChatApp !== 'undefined') {
                rootComponent = SohChatApp;
            } else if (jsFileName === 'logged-in-users' && typeof UsersApp !== 'undefined') {
                rootComponent = UsersApp;
            } else if (jsFileName === 'logged-in-all-registrations' && typeof AllRegistrationsApp !== 'undefined') {
                rootComponent = AllRegistrationsApp;
            } else if (jsFileName === 'logged-in-tournament-settings' && typeof TournamentSettingsApp !== 'undefined') {
                rootComponent = TournamentSettingsApp;
            }

            if (rootComponent && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
                const root = ReactDOM.createRoot(rootElement);
                root.render(React.createElement(rootComponent, null));
                highlightActiveMenuItem(); // Zvýrazníme aktívnu položku po načítaní obsahu
            } else {
                console.warn(`Komponent pre ${jsFileName} nie je definovaný alebo React/ReactDOM nie sú načítané.`);
                rootElement.innerHTML = `<div class="text-red-500 text-center p-4">Chyba: Komponent pre stránku "${jsFileName}" sa nenašiel.</div>`;
            }
        };
        scriptElement.onerror = (e) => {
            console.error(`Chyba pri načítaní skriptu ${jsFileName}.js:`, e);
            rootElement.innerHTML = `<div class="text-red-500 text-center p-4">Chyba pri načítaní obsahu. Skript ${jsFileName}.js chýba alebo je poškodený.</div>`;
        };
        
        // Skontrolujte, či skript už neexistuje, aby ste sa vyhli duplicitnému načítaniu
        if (!document.querySelector(`script[src="${jsFileName}.js"]`)) {
            document.body.appendChild(scriptElement); // Pridajte skript do body
        } else {
            // Ak skript už existuje, jednoducho vykreslite komponent, ak je už definovaný
            let rootComponent = null;
            if (jsFileName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                rootComponent = MyDataApp;
            } else if (jsFileName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
                rootComponent = ChangeNameApp;
            } else if (jsFileName === 'logged-in-change-phone' && typeof ChangePhoneApp !== 'undefined') {
                rootComponent = ChangePhoneApp;
            } else if (jsFileName === 'logged-in-email' && typeof ChangeEmailApp !== 'undefined') {
                rootComponent = ChangeEmailApp;
            } else if (jsFileName === 'logged-in-change-password' && typeof ChangePasswordApp !== 'undefined') {
                rootComponent = ChangePasswordApp;
            } else if (jsFileName === 'logged-in-change-billing-data' && typeof ChangeBillingDataApp !== 'undefined') {
                rootComponent = ChangeBillingDataApp;
            } else if (jsFileName === 'logged-in-my-settings' && typeof MySettingsApp !== 'undefined') {
                rootComponent = MySettingsApp;
            } else if (jsFileName === 'logged-in-notifications' && typeof NotificationsApp !== 'undefined') {
                rootComponent = NotificationsApp;
            } else if (jsFileName === 'logged-in-soh-chat' && typeof SohChatApp !== 'undefined') {
                rootComponent = SohChatApp;
            } else if (jsFileName === 'logged-in-users' && typeof UsersApp !== 'undefined') {
                rootComponent = UsersApp;
            } else if (jsFileName === 'logged-in-all-registrations' && typeof AllRegistrationsApp !== 'undefined') {
                rootComponent = AllRegistrationsApp;
            } else if (jsFileName === 'logged-in-tournament-settings' && typeof TournamentSettingsApp !== 'undefined') {
                rootComponent = TournamentSettingsApp;
            }

            if (rootComponent && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
                const root = ReactDOM.createRoot(rootElement);
                root.render(React.createElement(rootComponent, null));
                highlightActiveMenuItem(); // Zvýrazníme aktívnu položku po opätovnom načítaní
            } else {
                console.warn(`Komponent pre ${jsFileName} nie je definovaný po opätovnom načítaní.`);
                rootElement.innerHTML = `<div class="text-red-500 text-center p-4">Chyba: Komponent pre stránku "${jsFileName}" sa nenašiel po opätovnom načítaní.</div>`;
            }
        }
    } catch (error) {
        console.error(`Chyba pri načítaní obsahu pre ${jsFileName}:`, error);
        rootElement.innerHTML = `<div class="text-red-500 text-center p-4">Chyba pri načítaní obsahu. ${error.message}</div>`;
    }
}

// Funkcia na aktualizáciu viditeľnosti položiek menu
// Táto funkcia je sprístupnená globálne, aby ju mohla volať hlavná aplikácia
// po načítaní používateľskej roly.
window.updateMenuItemsVisibility = function(userRole) {
    console.log("updateMenuItemsVisibility volaná s rolou:", userRole); // Debugovací výpis
    const menuItems = {
        'menu-my-data': ['admin', 'user'],
        'menu-change-name': ['admin', 'user'],
        'menu-change-phone': ['user'],
        'menu-change-email': ['admin', 'user'],
        'menu-change-password': ['admin', 'user'],
        'menu-change-billing-data': ['user'],
        'menu-my-settings': ['admin'], 
        'menu-notifications': ['admin'],
        'menu-soh-chat': ['admin'],
        'menu-users': ['admin'],
        'menu-all-registrations': ['admin'],
        'menu-tournament-settings': ['admin']
    };

    for (const id in menuItems) {
        const element = document.getElementById(id);
        if (element) {
            // Získame rodičovský <li> element
            const listItem = element.closest('li');
            if (listItem) {
                if (menuItems[id].includes(userRole)) {
                    listItem.classList.remove('hidden');
                    console.log(`Zobrazujem: ${id} pre rolu: ${userRole}`); // Debugovací výpis
                } else {
                    listItem.classList.add('hidden');
                    console.log(`Skrývam: ${id} pre rolu: ${userRole}`); // Debugovací výpis
                }
            }
        }
    }
    // Po aktualizácii viditeľnosti menu zvýrazníme aktívnu položku
    highlightActiveMenuItem();
};

// NOVINKA: Funkcia na prepínanie viditeľnosti ľavého menu
function toggleLeftMenu() {
    const leftMenuNav = document.getElementById('left-menu-nav');
    const menuToggleIcon = document.getElementById('menu-toggle-icon');
    const mainContentArea = document.getElementById('main-content-area');
    const menuTitle = leftMenuNav ? leftMenuNav.querySelector('h2') : null; // Získame nadpis "Možnosti"
    const menuItemsList = document.getElementById('menu-items-list');

    if (leftMenuNav && menuToggleIcon && mainContentArea && menuTitle && menuItemsList) {
        // Skontrolujeme, či je menu momentálne otvorené (pozícia left: 0px)
        const isCurrentlyOpen = leftMenuNav.style.left === '0px' || leftMenuNav.style.left === ''; // Prázdny reťazec pre počiatočný stav

        if (isCurrentlyOpen) { // Menu je otvorené, teraz ho skryjeme (posunieme doľava)
            leftMenuNav.style.left = '-192px'; // Posunieme menu o (256px - 64px) doľava, aby zostalo viditeľných 64px
            menuTitle.classList.add('hidden'); // Skryjeme text nadpisu
            menuItemsList.classList.add('hidden'); // Skryjeme zoznam položiek menu
            menuToggleIcon.classList.add('rotate-180'); // Otočíme ikonku
            mainContentArea.classList.remove('ml-64');
            mainContentArea.classList.add('ml-16'); // Posunieme hlavný obsah doľava
            localStorage.setItem('leftMenuHidden', 'true');
        } else { // Menu je skryté, teraz ho zobrazíme (posunieme doprava)
            leftMenuNav.style.left = '0px'; // Posunieme menu späť na pôvodnú pozíciu
            menuTitle.classList.remove('hidden'); // Zobrazíme text nadpisu
            menuItemsList.classList.remove('hidden'); // Zobrazíme zoznam položiek menu
            menuToggleIcon.classList.remove('rotate-180'); // Resetujeme rotáciu ikonky
            mainContentArea.classList.remove('ml-16');
            mainContentArea.classList.add('ml-64'); // Posunieme hlavný obsah doprava
            localStorage.setItem('leftMenuHidden', 'false');
        }
        // Po zmene stavu menu aktualizujeme farbu ikonky
        highlightActiveMenuItem();
    }
}

// Spracovanie kliknutí na odkazy v menu
document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('.w-64 a'); // Všetky odkazy v navigačnom menu
    menuLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            // NOVINKA: Ak je odkaz aktívny, zabránime predvolenému správaniu a nebudeme načítavať obsah
            if (link.classList.contains('bg-blue-600')) {
                event.preventDefault();
                console.log("Kliknutie na aktívnu položku menu bolo zablokované.");
                return; // Ukončíme funkciu, aby sa nenačítal obsah
            }

            event.preventDefault(); // Zabrániť predvolenému správaniu odkazu
            const href = link.getAttribute('href');
            // Získame len názov súboru bez .html pre loadContent
            const jsFileName = href.replace('.html', '');
            
            // Voláme globálnu funkciu loadContent
            if (typeof loadContent === 'function') {
                loadContent(jsFileName); 
            } else {
                console.error("loadContent funkcia nie je definovaná.");
            }
        });
    });

    // NOVINKA: Pridanie poslucháča udalostí pre tlačidlo prepínania menu
    const menuToggleButton = document.getElementById('menu-toggle-button');
    if (menuToggleButton) {
        menuToggleButton.addEventListener('click', toggleLeftMenu);
    } else {
        console.error("Tlačidlo pre prepínanie menu (menu-toggle-button) nebolo nájdené!");
    }

    // ZMENA: Presunutie logiky načítania stavu menu z localStorage do funkcie, ktorá sa vykoná po načítaní všetkých skriptov
    // Toto zabezpečí, že DOM a CSS sú plne načítané a pripravené pred aplikovaním tried.
    window.addEventListener('load', () => {
        const isMenuHidden = localStorage.getItem('leftMenuHidden') === 'true';
        const leftMenuNav = document.getElementById('left-menu-nav');
        const menuToggleIcon = document.getElementById('menu-toggle-icon');
        const mainContentArea = document.getElementById('main-content-area');
        const menuTitle = leftMenuNav ? leftMenuNav.querySelector('h2') : null;
        const menuItemsList = document.getElementById('menu-items-list');


        if (leftMenuNav && menuToggleIcon && mainContentArea && menuTitle && menuItemsList) {
            // Odstránime prechodné triedy, aby sa stav aplikoval okamžite pri načítaní
            leftMenuNav.classList.remove('transition-all', 'duration-300', 'ease-in-out');

            if (isMenuHidden) {
                leftMenuNav.style.left = '-192px'; // Nastavíme počiatočnú pozíciu na skrytú
                menuTitle.classList.add('hidden'); // Skryjeme text nadpisu
                menuItemsList.classList.add('hidden'); // Skryjeme zoznam položiek menu
                menuToggleIcon.classList.add('rotate-180'); // Otočíme ikonku
                mainContentArea.classList.remove('ml-64');
                mainContentArea.classList.add('ml-16'); // Posunieme hlavný obsah doľava
            } else {
                leftMenuNav.style.left = '0px'; // Nastavíme počiatočnú pozíciu na zobrazenú
                menuTitle.classList.remove('hidden'); // Zobrazíme text nadpisu
                menuItemsList.classList.remove('hidden'); // Zobrazíme zoznam položiek menu
                menuToggleIcon.classList.remove('rotate-180'); // Resetujeme rotáciu ikonky
                mainContentArea.classList.remove('ml-16');
                mainContentArea.classList.add('ml-64'); // Posunieme hlavný obsah doprava
            }

            // Po aplikovaní stavu môžeme vrátiť prechodné triedy
            // Použijeme setTimeout, aby sa triedy pridali až po vykonaní zmien DOM a umožnili animácie pri ďalších kliknutiach
            setTimeout(() => {
                leftMenuNav.classList.add('transition-all', 'duration-300', 'ease-in-out');
            }, 0);
        }
        // Zvýrazníme aktívnu položku aj pri prvom načítaní stránky
        highlightActiveMenuItem();
    });

    // Zvýrazníme aktívnu položku aj pri prvom načítaní stránky (pre prípad, že load listener sa spustí neskôr)
    highlightActiveMenuItem();
})
