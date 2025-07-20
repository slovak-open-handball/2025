// Global application ID and Firebase configuration (should be consistent across all React apps)
// Tieto konštanty sú duplikované tu, aby bol left-menu.js samostatný.
const appId = '1:26454452024:web:6954b4f90f87a3a1eb43cd';
const firebaseConfig = {
  apiKey: "AIzaSyDj_bSTkjrquu1nyIVYW7YLbyBl1pD6YYo",
  authDomain: "prihlasovanie-4f3f3.firebaseapp.com",
  projectId: "prihlasovanie-4f3f3",
  storageBucket: "prihlasovanie-4f3f3.firebasestorage.app",
  messagingSenderId: "26454452024",
  appId: "1:26454452024:web:6954b4f90f87a3a1eb43cd"
};
const initialAuthToken = null; // Global authentication token

// Inicializácia Firebase (ak už nie je inicializovaná iným skriptom)
let firebaseAppMenu; // Použijeme iný názov pre inštanciu aplikácie menu
let authMenu;
let dbMenu;

try {
    // Skontrolujeme, či už existuje inštancia Firebase s týmto názvom
    firebaseAppMenu = firebase.apps.find(app => app.name === 'menuApp') || firebase.initializeApp(firebaseConfig, 'menuApp');
    authMenu = firebase.auth(firebaseAppMenu);
    dbMenu = firebase.firestore(firebaseAppMenu);
} catch (e) {
    console.error("Chyba pri inicializácii Firebase pre ľavé menu:", e);
}

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
function updateMenuItemsVisibility(userRole) {
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
            if (menuItems[id].includes(userRole)) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }
}

// Počúvanie zmien stavu autentifikácie
if (authMenu && dbMenu) {
    authMenu.onAuthStateChanged(async (user) => {
        if (!user) {
            // Ak používateľ nie je prihlásený, presmerovať na prihlasovaciu stránku
            console.log("Používateľ nie je prihlásený, presmerovanie na login.html z left-menu.js");
            window.location.href = 'login.html';
            return;
        }

        // Používateľ je prihlásený, získať jeho rolu
        try {
            const userDoc = await dbMenu.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const userRole = userData.role || 'user'; // Predvolená rola je 'user'
                console.log("Používateľská rola (left-menu):", userRole);
                updateMenuItemsVisibility(userRole);

                // Načítať počiatočný obsah: buď z URL parametra 'page', alebo predvolene na 'logged-in-my-data.html'
                const urlParams = new URLSearchParams(window.location.search);
                const initialPage = urlParams.get('page');
                if (initialPage) {
                    loadContent(initialPage);
                } else {
                    loadContent('logged-in-my-data.html'); // Predvolená stránka
                }
            } else {
                console.warn("Používateľský dokument nebol nájdený pre ID:", user.uid);
                // Ak sa nenájde dokument, predpokladáme rolu 'user' alebo odhlásime
                updateMenuItemsVisibility('user');
                loadContent('logged-in-my-data.html'); // Načítať predvolenú stránku
            }
        } catch (error) {
            console.error("Chyba pri načítaní používateľskej roly z Firestore pre left-menu:", error);
            // V prípade chyby zobraziť len základné položky menu pre 'user'
            updateMenuItemsVisibility('user');
            loadContent('logged-in-my-data.html'); // Načítať predvolenú stránku
        }
    });

    // Počiatočné prihlásenie pre menu (ak existuje vlastný token)
    if (initialAuthToken) {
        authMenu.signInWithCustomToken(initialAuthToken).catch(e => {
            console.error("Chyba pri počiatočnom prihlásení Firebase pre ľavé menu:", e);
        });
    }
}

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

    // Odstránený poslucháč 'hashchange', pretože už nepoužívame hash navigáciu.
    // Počiatočné načítanie obsahu sa vykonáva v onAuthStateChanged.
});
