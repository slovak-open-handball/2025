    // Tento súbor už nenačítava Firebase ani nevykonáva autentifikáciu.
    // Spolieha sa na to, že Firebase je inicializované a používateľ je prihlásený v hlavnej aplikácii.

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
        // ReactDOM.unmountComponentAtNode(rootElement); // Toto je pre React 17 a staršie, pre React 18 použite root.unmount()
        // Ak už existuje root, odmontujte ho
        if (rootElement._reactRootContainer) { // Kontrola existencie React 18 root kontajnera
            rootElement._reactRootContainer.unmount();
        }
        rootElement.innerHTML = '<div class="flex items-center justify-center h-full text-xl text-gray-700">Načítavam obsah...</div>';

        try {
            // Dynamicky načítať JS súbor s React komponentom
            const scriptElement = document.createElement('script');
            scriptElement.src = `${jsFileName}.js`;
            // Zabezpečíme, aby sa skript načítal len raz
            scriptElement.onload = () => {
                let rootComponent = null;
                // Určiť, ktorý React komponent sa má vykresliť na základe jsFileName
                // POZNÁMKA: Tu je potrebné pridať podmienky pre každý React komponent,
                // ktorý chcete dynamicky načítavať.
                if (jsFileName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                    rootComponent = MyDataApp;
                } else if (jsFileName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
                    rootComponent = ChangeNameApp;
                } else if (jsFileName === 'logged-in-change-phone' && typeof ChangePhoneApp !== 'undefined') { // NOVÁ PODMIENKA
                    rootComponent = ChangePhoneApp; // NOVÝ KOMPONENT
                } else if (jsFileName === 'logged-in-change-password' && typeof ChangePasswordApp !== 'undefined') {
                    rootComponent = ChangePasswordApp;
                } else if (jsFileName === 'logged-in-my-settings' && typeof MySettingsApp !== 'undefined') {
                    rootComponent = MySettingsApp;
                } else if (jsFileName === 'logged-in-notifications' && typeof NotificationsApp !== 'undefined') {
                    rootComponent = NotificationsApp;
                } else if (jsFileName === 'logged-in-soh-chat' && typeof SohChatApp !== 'undefined') { // ZMENA: Preimenované
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
                } else if (jsFileName === 'logged-in-change-phone' && typeof ChangePhoneApp !== 'undefined') { // NOVÁ PODMIENKA
                    rootComponent = ChangePhoneApp;
                } else if (jsFileName === 'logged-in-change-password' && typeof ChangePasswordApp !== 'undefined') {
                    rootComponent = ChangePasswordApp;
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
        const menuItems = {
            'menu-my-data': ['admin', 'user'],
            'menu-change-name': ['admin', 'user'],
            'menu-change-phone': ['user'],
            'menu-change-password': ['admin', 'user'],
            'menu-my-settings': ['admin', 'user'],
            'menu-notifications': ['admin'], // TOTO JE KĽÚČOVÁ ZMENA
            'menu-soh-chat': ['admin'],
            'menu-users': ['admin'],
            'menu-all-registrations': ['admin'],
            'menu-tournament-settings': ['admin']
        };

        for (const id in menuItems) {
            const element = document.getElementById(id);
            if (element) {
                if (menuItems[id].includes(userRole)) {
                    element.classList.remove('hidden');
                } else {
                    element.classList.add('hidden');
                }
            }
        }
    };

    // Spracovanie kliknutí na odkazy v menu
    document.addEventListener('DOMContentLoaded', () => {
        const menuLinks = document.querySelectorAll('.w-64 a'); // Všetky odkazy v navigačnom menu
        menuLinks.forEach(link => {
            link.addEventListener('click', (event) => {
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

        // ZMENA: Odstránené počiatočné volanie loadContent('logged-in-my-data.html');
        // Teraz sa spoliehame na logged-in-my-data.html, že vykreslí MyDataApp na začiatku.
        // MyDataApp potom zavolá updateMenuItemsVisibility.
    });
