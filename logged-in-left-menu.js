// logged-in-left-menu.js
// Tento súbor spravuje logiku pre ľavé menu, vrátane jeho rozbalenia/zbalenia
// a obsluhy udalostí pri kliknutí a prechode myšou.
// Bola pridaná nová funkcionalita na ukladanie stavu menu do databázy používateľa.

// Importy pre potrebné Firebase funkcie
import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Funkcia na zobrazenie/skrytie menu a uloženie stavu do databázy.
 * @param {object} userProfileData - Dáta o profile používateľa.
 */
const setupMenuListeners = (userProfileData) => {
    const leftMenu = document.getElementById('left-menu');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const menuTexts = document.querySelectorAll('#left-menu .whitespace-nowrap');
    const menuSpacer = document.querySelector('#main-content-area > .flex-shrink-0');

    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button, textové elementy alebo menu spacer po vložení HTML.");
        return;
    }

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
        const db = window.db;
        const userId = window.globalUserProfileData?.id;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        if (!db || !userId || !appId) {
            console.error("left-menu.js: DB, userId alebo appId nie sú dostupné pre uloženie stavu menu.");
            return;
        }

        try {
            const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
            await updateDoc(userDocRef, {
                isMenuToggled: state
            });
            console.log("left-menu.js: Stav menu bol úspešne uložený.");
        } catch (error) {
            console.error("left-menu.js: Chyba pri ukladaní stavu menu:", error);
            // Ak dokument neexistuje, vytvoríme ho s daným stavom
            try {
                const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
                await setDoc(userDocRef, { isMenuToggled: state }, { merge: true });
                console.log("left-menu.js: Dokument používateľa bol vytvorený a stav menu uložený.");
            } catch (createError) {
                console.error("left-menu.js: Chyba pri vytváraní dokumentu používateľa:", createError);
            }
        }
    };

    menuToggleButton.addEventListener('click', () => {
        isMenuToggled = !isMenuToggled;
        applyMenuState();
        saveMenuState(isMenuToggled);
    });

    leftMenu.addEventListener('mouseenter', () => {
        if (!isMenuToggled) {
            leftMenu.classList.add('hover:w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
        }
    });

    leftMenu.addEventListener('mouseleave', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('hover:w-64');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
        }
    });
};

/**
 * Funkcia na načítanie HTML obsahu menu a nastavenie poslucháčov.
 * @param {object} userProfileData - Dáta o profile používateľa.
 */
const loadLeftMenu = async (userProfileData) => {
    if (userProfileData) {
        const menuPlaceholder = document.getElementById('menu-placeholder');
        if (!menuPlaceholder) {
            console.error("left-menu.js: Nebol nájdený žiadny element s ID 'menu-placeholder'.");
            return;
        }

        try {
            const response = await fetch('logged-in-left-menu.html');
            if (!response.ok) {
                throw new Error(`HTTP chyba: ${response.status} ${response.statusText}`);
            }
            const menuHtml = await response.text();
            menuPlaceholder.innerHTML = menuHtml;
            console.log("left-in-left-menu-js: Obsah menu bol úspešne vložený do placeholderu.");

            // Po úspešnom vložení HTML hneď nastavíme poslucháčov
            setupMenuListeners(userProfileData);
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
    console.log('left-menu.js: Globálne dáta už existujú. Vykresľujem aplikáciu okamžite.');
    loadLeftMenu(window.globalUserProfileData);
}
