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
    const menuTexts = document.querySelectorAll('#left-menu .whitespace-nowrap'); // Zmena selektora
    const menuSpacer = document.querySelector('#main-content-area > .flex-shrink-0'); // Nový element, ktorý sledujeme
    
    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button, textové elementy alebo menu spacer po vložení HTML.");
        return;
    }

    const userId = userProfileData.id;
    const db = window.db;

    // Inicializujeme stav menu z dát používateľa alebo na false, ak nie je definovaný
    let isMenuToggled = userProfileData?.isMenuToggled || false;
    
    // Funkcia na aplikovanie stavu menu (pre počiatočné načítanie)
    const applyMenuState = () => {
        if (isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
        } else {
            leftMenu.classList.add('w-16');
            leftMenu.classList.remove('w-64');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
        }
    };

    // Aplikujeme počiatočný stav
    applyMenuState();

    // Funkcia na uloženie stavu do databázy
    const saveMenuState = async (state) => {
        if (db && userId) {
            try {
                const userDocRef = doc(db, 'artifacts', window.__app_id, 'users', userId);
                await updateDoc(userDocRef, { isMenuToggled: state });
                console.log("Stav menu bol úspešne uložený do databázy.");
            } catch (e) {
                console.error("Chyba pri ukladaní stavu menu: ", e);
            }
        } else {
            console.error("DB alebo userId nie sú dostupné pre uloženie stavu menu.");
        }
    };

    // Poslucháč pre tlačidlo
    menuToggleButton.addEventListener('click', (event) => {
        event.stopPropagation();
        isMenuToggled = !isMenuToggled;
        applyMenuState();
        saveMenuState(isMenuToggled);
    });

    // Pridáme poslucháčov na menu pre správne správanie myši, ak je menu zbalené
    const handleMouseEnter = () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
        }
    };

    const handleMouseLeave = () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-64');
            leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
        }
    };

    leftMenu.addEventListener('mouseenter', handleMouseEnter);
    leftMenu.addEventListener('mouseleave', handleMouseLeave);

    console.log("left-menu.js: Poslucháči udalostí menu sú nastavení.");
};

const loadLeftMenu = async (userProfileData) => {
    // Ak nemáme dáta o používateľovi, menu nenačítame a skryjeme
    if (!userProfileData) {
        const leftMenuElement = document.getElementById('left-menu');
        if (leftMenuElement) {
            leftMenuElement.classList.add('hidden');
        }
        console.log("left-menu.js: Globálne dáta používateľa nie sú dostupné. Menu sa skryje.");
        return;
    }
    
    const menuPlaceholder = document.getElementById('left-menu-placeholder');
    if (menuPlaceholder) {
        try {
            console.log("left-menu.js: Načítavam left-menu.html...");
            const response = await fetch('logged-in-left-menu.html');
            if (!response.ok) {
                throw new Error(`Chyba pri načítaní: ${response.status} ${response.statusText}`);
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
    console.log('left-menu.js: Globálne dáta už existujú. Načítavam menu okamžite.');
    loadLeftMenu(window.globalUserProfileData);
}
