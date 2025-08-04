// logged-in-left-menu.js
// Tento súbor spravuje logiku pre ľavé menu, vrátane jeho rozbalenia/zbalenia
// a obsluhy udalostí pri kliknutí a prechode myšou.
// Bola pridaná nová funkcionalita na ukladanie stavu menu do databázy používateľa.

// Importy pre potrebné Firebase funkcie
import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Funkcia, ktorá sa spustí po načítaní HTML obsahu menu
const setupMenuListeners = (userProfileData) => {
    const leftMenu = document.getElementById('left-menu');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const menuTexts = document.querySelectorAll('#left-menu .group-hover\\:opacity-100');

    if (!leftMenu || !menuToggleButton || menuTexts.length === 0) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button alebo textové elementy po vložení HTML.");
        return;
    }

    const userId = userProfileData.id;
    const db = window.db;

    // Inicializujeme stav menu z dát používateľa alebo na false, ak nie je definovaný
    let isMenuToggled = userProfileData?.isMenuToggled || false;
    
    // Funkcia na aplikovanie stavu menu (pre počiatočné načítanie)
    const applyMenuState = () => {
        if (isMenuToggled) {
            leftMenu.classList.remove('w-16', 'hover:w-64', 'group');
            leftMenu.classList.add('w-64', 'is-toggled');
            menuTexts.forEach(text => {
                text.classList.remove('opacity-0');
                text.classList.add('opacity-100');
            });
        } else {
            leftMenu.classList.remove('w-64', 'is-toggled');
            leftMenu.classList.add('w-16', 'hover:w-64', 'group');
            menuTexts.forEach(text => {
                text.classList.remove('opacity-100');
                text.classList.add('opacity-0');
            });
        }
    };

    // Aplikujeme počiatočný stav menu hneď po načítaní
    applyMenuState();

    // Asynchrónna funkcia pre prepínanie a ukladanie stavu menu
    const toggleMenu = async () => {
        isMenuToggled = !isMenuToggled;
        console.log(`left-menu.js: Prepínam menu. Stav: ${isMenuToggled}`);
        
        applyMenuState(); // Aplikujeme nový stav

        // Uložíme nový stav do Firestore
        try {
            if (db && userId) {
                const userDocRef = doc(db, 'users', userId);
                // Používame updateDoc na aktualizáciu existujúceho poľa, alebo setDoc s merge: true
                // ak by pole neexistovalo. Ale v tomto prípade je priamo na koreni, takže je to jednoduchšie.
                await updateDoc(userDocRef, {
                    isMenuToggled: isMenuToggled
                });
                console.log("left-menu.js: Stav menu bol úspešne uložený do databázy.");
            }
        } catch (error) {
            console.error("left-menu.js: Chyba pri ukladaní stavu menu do databázy:", error);
        }
    };

    // Event listener pre kliknutie na tlačidlo
    menuToggleButton.addEventListener('click', toggleMenu);

    console.log("left-menu.js: Listener pre tlačidlo prepínania menu bol pridaný.");
}

// Hlavná funkcia na načítanie menu
window.loadLeftMenu = async (userProfileData) => {
    console.log("left-menu.js: Spúšťam funkciu loadLeftMenu.");

    // Kontrola existencie globálnych používateľských dát
    if (userProfileData) {
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
            console.log("left-in-left-menu-js: Obsah menu bol úspešne vložený do placeholderu.");

            // Po úspešnom vložení HTML hneď nastavíme poslucháčov
            setupMenuListeners(userProfileData); // Teraz odovzdávame dáta
            const leftMenuElement = document.getElementById('left-menu');
            if (leftMenuElement) {
                leftMenuElement.classList.remove('hidden');
            }

        } catch (error) {
            console.error("left-menu.js: Chyba pri inicializácii ľavého menu:", error);
        }
    } else {
        const leftMenuElement = document.getElementById('left-menu');
        if (leftMenuElement) {
            leftMenuElement.classList.add('hidden');
        }
        console.log("left-menu.js: Globálne dáta používateľa nie sú dostupné. Menu sa skryje.");
    }
};

// Počúvanie udalosti globalDataUpdated, ktorá je odoslaná, keď sú dáta používateľa k dispozícii
window.addEventListener('globalDataUpdated', (event) => {
    console.log('left-menu.js: Prijatá udalosť "globalDataUpdated". Kontrolujem dáta...');
    loadLeftMenu(event.detail);
});

// Kontrola pri prvom načítaní pre prípad, že event už prebehol
if (window.globalUserProfileData) {
    console.log('left-menu.js: Globálne dáta už existujú. Načítavam menu pri štarte.');
    loadLeftMenu(window.globalUserProfileData);
}
