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
async function loadContent(pageName) {
    const contentArea = document.getElementById('main-content-area');
    if (!contentArea) {
        console.error("Element s ID 'main-content-area' nebol nájdený.");
        return;
    }

    // Zobraziť loading indikátor
    contentArea.innerHTML = '<div class="flex items-center justify-center h-full text-xl text-gray-700">Načítavam obsah...</div>';

    try {
        const response = await fetch(`${pageName}.html`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const htmlContent = await response.text();
        contentArea.innerHTML = htmlContent;

        // Ak stránka obsahuje React komponent, musíme ho znova vykresliť
        // Toto je zjednodušená verzia, ktorá predpokladá, že každý JS súbor definuje globálny komponent
        const scriptElement = document.createElement('script');
        scriptElement.src = `${pageName}.js`;
        scriptElement.onload = () => {
            // Po načítaní skriptu, ak existuje globálny komponent, vykreslíme ho
            let rootComponent = null;
            if (pageName === 'logged-in-my-data' && typeof MyDataApp !== 'undefined') {
                rootComponent = MyDataApp;
            }
            // TODO: Pridať ďalšie podmienky pre iné komponenty, keď budú vytvorené
            // else if (pageName === 'logged-in-change-name' && typeof ChangeNameApp !== 'undefined') {
            //     rootComponent = ChangeNameApp;
            // }

            if (rootComponent && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined') {
                const rootElement = document.getElementById('root'); // Predpokladáme, že každý HTML fragment má #root
                if (rootElement) {
                    const root = ReactDOM.createRoot(rootElement);
                    root.render(React.createElement(rootComponent, null));
                } else {
                    console.warn(`Element #root nebol nájdený pre stránku ${pageName}.`);
                }
            }
        };
        scriptElement.onerror = (e) => {
            console.error(`Chyba pri načítaní skriptu ${pageName}.js:`, e);
            contentArea.innerHTML = `<div class="text-red-500 text-center p-4">Chyba pri načítaní obsahu. Skript ${pageName}.js chýba alebo je poškodený.</div>`;
        };
        document.body.appendChild(scriptElement); // Pridáme skript do body
    } catch (error) {
        console.error(`Chyba pri načítaní obsahu pre ${pageName}.html:`, error);
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

                // Načítať počiatočný obsah na základe hash alebo predvolene na Moje údaje
                const initialHash = window.location.hash.substring(1); // Odstrániť '#'
                if (initialHash) {
                    loadContent(`logged-in-${initialHash}`);
                } else {
                    loadContent('logged-in-my-data'); // Predvolená stránka
                }
            } else {
                console.warn("Používateľský dokument nebol nájdený pre ID:", user.uid);
                // Ak sa nenájde dokument, predpokladáme rolu 'user' alebo odhlásime
                updateMenuItemsVisibility('user');
                loadContent('logged-in-my-data'); // Načítať predvolenú stránku
            }
        } catch (error) {
            console.error("Chyba pri načítaní používateľskej roly z Firestore pre left-menu:", error);
            // V prípade chyby zobraziť len základné položky menu pre 'user'
            updateMenuItemsVisibility('user');
            loadContent('logged-in-my-data'); // Načítať predvolenú stránku
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
            const hash = link.getAttribute('href').substring(1); // Získať hash bez '#'
            window.location.hash = hash; // Aktualizovať hash v URL
            loadContent(`logged-in-${hash}`); // Načítať obsah
        });
    });

    // Načítať obsah pri zmene hash v URL (napr. pri navigácii späť/vpred v prehliadači)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            loadContent(`logged-in-${hash}`);
        } else {
            loadContent('logged-in-my-data'); // Predvolená stránka, ak hash chýba
        }
    });
});
