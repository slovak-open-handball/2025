// Tento súbor obsahuje logiku pre ľavé navigačné menu.
// Je navrhnutý tak, aby fungoval nezávisle od hlavnej aplikácie
// pre prepínanie svojho zbaleného/rozbaleného stavu.

// Funkcia na zvýraznenie aktívnej položky menu
// Táto funkcia je ponechaná, ak by ju volala hlavná aplikácia pre vizuálnu konzistenciu,
// ale samotné prepínanie menu na ňu už nezávisí.
function highlightActiveMenuItem() {
    // Odstránime zvýraznenie a triedy pre neklikateľnosť zo všetkých predtým aktívnych položiek
    const allMenuItems = document.querySelectorAll('#left-menu-nav ul li a'); // Selektor pre odkazy v menu
    allMenuItems.forEach(item => {
        item.classList.remove('bg-blue-600', 'font-bold', 'text-white', 'cursor-default', 'pointer-events-none');
        item.classList.add('hover:bg-blue-600'); // Vrátime hover efekt
    });

    // Získame aktuálnu cestu URL (napr. /logged-in-my-data.html)
    const currentPath = window.location.pathname;
    // Získame len názov súboru (napr. logged-in-my-data)
    const currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);

    // Nájdeme odkaz v menu, ktorého href atribút končí aktuálnou stránkou
    const activeLink = document.querySelector(`#left-menu-nav ul li a[href$="${currentPage}"]`);
    const menuToggleIcon = document.getElementById('menu-toggle-icon');

    if (menuToggleIcon) {
        // Vždy nastavíme farbu ikonky na bielu pre lepšiu viditeľnosť na tmavom pozadí menu
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
// Je ponechaná, pretože ju môže volať hlavná aplikácia.
async function loadContent(jsFileName) {
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
    if (rootElement._reactRootContainer) {
        rootElement._reactRootContainer.unmount();
    }
    rootElement.innerHTML = '<div class="flex items-center justify-center h-full text-xl text-gray-700">Načítavam...</div>';

    try {
        const scriptElement = document.createElement('script');
        scriptElement.src = `${jsFileName}.js`;
        
        scriptElement.onload = () => {
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
        
        if (!document.querySelector(`script[src="${jsFileName}.js"]`)) {
            document.body.appendChild(scriptElement);
        } else {
            let rootComponent = null;
            if (jsFileName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                rootComponent = MyDataApp;
            } else if (jsFileName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
                rootComponent = ChangeNameApp;
            } else if (jsFileName === 'logged-in-change-phone' && typeof ChangePhoneApp !== 'undefined') {
                rootComponent = ChangePhoneApp;
            } else if (jsFileName === 'logged-in-change-email' && typeof ChangeEmailApp !== 'undefined') {
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
                highlightActiveMenuItem();
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
    console.log("updateMenuItemsVisibility volaná s rolou:", userRole);
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
            const listItem = element.closest('li');
            if (listItem) {
                if (menuItems[id].includes(userRole)) {
                    listItem.classList.remove('hidden');
                    console.log(`Zobrazujem: ${id} pre rolu: ${userRole}`);
                } else {
                    listItem.classList.add('hidden');
                    console.log(`Skrývam: ${id} pre rolu: ${userRole}`);
                }
            }
        }
    }
    highlightActiveMenuItem();
};

// Funkcia na prepínanie viditeľnosti ľavého menu
function toggleLeftMenu() {
    console.log("toggleLeftMenu function called!");
    const leftMenuNav = document.getElementById('left-menu-nav');
    const menuToggleIcon = document.getElementById('menu-toggle-icon');
    const menuTitle = document.getElementById('menu-title');
    const menuItemsList = document.getElementById('menu-items-list');
    const bodyElement = document.body; // Získame element body

    if (leftMenuNav && menuToggleIcon && menuTitle && menuItemsList && bodyElement) {
        const isCurrentlyExpanded = leftMenuNav.style.width === '256px' || leftMenuNav.style.width === ''; // Predvolená šírka je 256px

        if (isCurrentlyExpanded) {
            // Zbaliť menu
            leftMenuNav.style.width = '64px';
            menuTitle.classList.add('hidden');
            menuItemsList.classList.add('hidden');
            menuToggleIcon.classList.add('rotate-180'); // Otočiť šípku doprava
            bodyElement.style.paddingLeft = '64px'; // Upraviť padding body
            localStorage.setItem('leftMenuState', 'collapsed');
            console.log("Menu je teraz zbalené. Šírka:", leftMenuNav.style.width, "Body padding-left:", bodyElement.style.paddingLeft);
        } else {
            // Rozbaliť menu
            leftMenuNav.style.width = '256px';
            menuTitle.classList.remove('hidden');
            menuItemsList.classList.remove('hidden');
            menuToggleIcon.classList.remove('rotate-180'); // Otočiť šípku doľava
            bodyElement.style.paddingLeft = '256px'; // Upraviť padding body
            localStorage.setItem('leftMenuState', 'expanded');
            console.log("Menu je teraz rozbalené. Šírka:", leftMenuNav.style.width, "Body padding-left:", bodyElement.style.paddingLeft);
        }
    } else {
        console.error("toggleLeftMenu: Niektoré elementy menu neboli nájdené pre prepínanie.");
        console.log("leftMenuNav:", !!leftMenuNav, "menuToggleIcon:", !!menuToggleIcon, "menuTitle:", !!menuTitle, "menuItemsList:", !!menuItemsList, "bodyElement:", !!bodyElement);
    }
}

// Inicializácia stavu menu pri načítaní DOM
document.addEventListener('DOMContentLoaded', () => {
    const leftMenuNav = document.getElementById('left-menu-nav');
    const menuToggleIcon = document.getElementById('menu-toggle-icon');
    const menuTitle = document.getElementById('menu-title');
    const menuItemsList = document.getElementById('menu-items-list');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const bodyElement = document.body;

    if (leftMenuNav && menuToggleIcon && menuTitle && menuItemsList && menuToggleButton && bodyElement) {
        // Priradenie poslucháča udalostí pre tlačidlo prepínania menu
        menuToggleButton.addEventListener('click', toggleLeftMenu); // ZMENA: Opätovné priradenie poslucháča tu
        console.log("Poslucháč udalostí pre menu-toggle-button priradený.");

        // Načítanie stavu z localStorage
        const savedMenuState = localStorage.getItem('leftMenuState');
        if (savedMenuState === 'collapsed') {
            leftMenuNav.style.width = '64px';
            menuTitle.classList.add('hidden');
            menuItemsList.classList.add('hidden');
            menuToggleIcon.classList.add('rotate-180');
            bodyElement.style.paddingLeft = '64px'; // Nastaviť padding body pri zbalenom stave
            console.log("Menu inicializované ako zbalené z localStorage.");
        } else {
            leftMenuNav.style.width = '256px';
            menuTitle.classList.remove('hidden');
            menuItemsList.classList.remove('hidden');
            menuToggleIcon.classList.remove('rotate-180');
            bodyElement.style.paddingLeft = '256px'; // Nastaviť padding body pri rozbalenom stave
            console.log("Menu inicializované ako rozbalené (predvolené alebo z localStorage).");
        }
    } else {
        console.error("DOMContentLoaded: Niektoré elementy menu neboli nájdené pre inicializáciu.");
        console.log("leftMenuNav:", !!leftMenuNav, "menuToggleIcon:", !!menuToggleIcon, "menuTitle:", !!menuTitle, "menuItemsList:", !!menuItemsList, "menuToggleButton:", !!menuToggleButton, "bodyElement:", !!bodyElement);
    }
    highlightActiveMenuItem(); // Zvýrazníme aktívnu položku pri prvom načítaní
});

// Spracovanie kliknutí na odkazy v menu (ak sa menu rozbalí/zbalí, stále by mali fungovať)
document.addEventListener('click', (event) => {
    const link = event.target.closest('#left-menu-nav ul li a');
    if (link) {
        // Ak je odkaz aktívny, zabránime predvolenému správaniu a nebudeme načítavať obsah
        if (link.classList.contains('bg-blue-600')) {
            event.preventDefault();
            console.log("Kliknutie na aktívnu položku menu bolo zablokované.");
            return;
        }

        event.preventDefault();
        const href = link.getAttribute('href');
        const jsFileName = href.replace('.html', '');
        
        if (typeof loadContent === 'function') {
            loadContent(jsFileName);
        } else {
            console.error("loadContent funkcia nie je definovaná.");
        }
    }
});
