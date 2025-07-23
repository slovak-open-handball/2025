// Tento súbor už nenačítava Firebase ani nevykonáva autentifikáciu.
// Spolieha sa na to, že Firebase je inicializované a používateľ je prihlásený v hlavnej aplikácii.

// Funkcia na načítanie obsahu do hlavnej oblasti
async function loadContent(htmlFilePath) {
    const contentArea = document.getElementById('main-content-area');
    if (!contentArea) {
        console.error("Element s ID 'main-content-area' nebol nájdený.");
        return;
    }

    // Zobraziť loading indikátor
    contentArea.innerHTML = '<div class="flex items-center justify-center h-full text-xl text-gray-700">Načítavam obsah...</div>';

    try {
        const response = await fetch(htmlFilePath); // Použijeme htmlFilePath priamo
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const htmlContent = await response.text();
        contentArea.innerHTML = htmlContent;

        // Extrahovať základný názov pre JS súbor: napr. "logged-in-my-data" z "logged-in-my-data.html"
        const jsFileName = htmlFilePath.replace('.html', ''); 

        const scriptElement = document.createElement('script');
        scriptElement.src = `${jsFileName}.js`; // Načítať zodpovedajúci JS súbor
        scriptElement.onload = () => {
            let rootComponent = null;
            // Určiť, ktorý React komponent sa má vykresliť na základe jsFileName
            // Táto časť sa bude musieť aktualizovať, keď sa vytvoria nové komponenty.
            if (jsFileName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                rootComponent = MyDataApp;
            } else if (jsFileName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
                rootComponent = ChangeNameApp;
            } else if (jsFileName === 'logged-in-change-password' && typeof ChangePasswordApp !== 'undefined') {
                rootComponent = ChangePasswordApp;
            } else if (jsFileName === 'logged-in-my-settings' && typeof MySettingsApp !== 'undefined') {
                rootComponent = MySettingsApp;
            } else if (jsFileName === 'logged-in-notifications' && typeof NotificationsApp !== 'undefined') {
                rootComponent = NotificationsApp;
            } else if (jsFileName === 'logged-in-send-message' && typeof SendMessageApp !== 'undefined') {
                rootComponent = SendMessageApp;
            } else if (jsFileName === 'logged-in-users' && typeof UsersApp !== 'undefined') {
                rootComponent = UsersApp;
            } else if (jsFileName === 'logged-in-all-registrations' && typeof AllRegistrationsApp !== 'undefined') {
                rootComponent = AllRegistrationsApp;
            } else if (jsFileName === 'logged-in-tournament-settings' && typeof TournamentSettingsApp !== 'undefined') {
                rootComponent = TournamentSettingsApp;
            }


            if (rootComponent && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
                const rootElement = document.getElementById('root');
                if (rootElement) {
                    const root = ReactDOM.createRoot(rootElement);
                    root.render(React.createElement(rootComponent, null));
                } else {
                    console.warn(`Element #root nebol nájdený pre stránku ${htmlFilePath}.`);
                }
            }
        };
        scriptElement.onerror = (e) => {
            console.error(`Chyba pri načítaní skriptu ${jsFileName}.js:`, e);
            contentArea.innerHTML = `<div class="text-red-500 text-center p-4">Chyba pri načítaní obsahu. Skript ${jsFileName}.js chýba alebo je poškodený.</div>`;
        };
        document.body.appendChild(scriptElement);
    } catch (error) {
        console.error(`Chyba pri načítaní obsahu pre ${htmlFilePath}:`, error);
        contentArea.innerHTML = `<div class="text-red-500 text-center p-4">Chyba pri načítaní obsahu. ${error.message}</div>`;
    }
}


// Funkcia na aktualizáciu viditeľnosti položiek menu
// Táto funkcia je sprístupnená globálne, aby ju mohla volať hlavná aplikácia
// po načítaní používateľskej roly.
window.updateMenuItemsVisibility = function(userRole) { // ZMENA: Sprístupnenie funkcie globálne
    const menuItems = {
        'menu-my-data': ['admin', 'user'],
        'menu-change-name': ['admin', 'user'],
        'menu-change-password': ['admin', 'user'],
        'menu-my-settings': ['admin', 'user'],
        'menu-notifications': ['admin', 'user'],
        'menu-send-message': ['admin'],
        'menu-users': ['admin'],
        'menu-all-registrations': ['admin'],
        'menu-tournament-settings': ['admin']
    };

    for (const id in menuItems) {
        const element = document.getElementById(id);
        if (element) {
            if (menuItems[id].includes(userRole)) { // Používame rolu priamo
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
            const fullPath = link.getAttribute('href'); // Získať celú cestu z href
            loadContent(fullPath); // Načítať obsah
        });
    });

    // Načítanie počiatočného obsahu po načítaní DOM
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('page');
    if (initialPage) {
        loadContent(initialPage);
    } else {
        loadContent('logged-in-my-data.html'); // Predvolená stránka
    }

    // ZMENA: Odstránené počiatočné volanie updateMenuItemsVisibility('user');
    // Teraz sa spoliehame na hlavnú aplikáciu (MyDataApp), že zavolá túto funkciu
    // s aktuálnou rolou používateľa po načítaní dát.
});
