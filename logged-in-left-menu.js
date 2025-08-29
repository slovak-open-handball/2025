// logged-in-left-menu.js
// Tento súbor spravuje logiku pre ľavé menu, vrátane jeho rozbalenia/zbalenia
// a obsluhy udalostí pri kliknutí a prechode myšou.
// Bola pridaná nová funkcionalita na ukladanie stavu menu do databázy používateľa.

// Importy pre potrebné Firebase funkcie
import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Funkcia na zobrazenie/skrytie menu a uloženie stavu do databázy.
 * @param {object} userProfileData - Dáta o profile používateľa.
 * @param {object} db - Inštancia Firestore databázy.
 * @param {string} userId - ID aktuálneho používateľa.
 */
const setupMenuListeners = (userProfileData, db, userId) => {
    const leftMenu = document.getElementById('left-menu');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const menuTexts = document.querySelectorAll('#left-menu .whitespace-nowrap'); // Zmena selektora
    const menuSpacer = document.querySelector('#main-content-area > .flex-shrink-0'); // Nový element, ktorý sledujeme
    const addCategoriesLink = document.getElementById('add-categories-link'); // Získanie odkazu na kategórie
    const tournamentSettingsLink = document.getElementById('tournament-settings-link'); // NOVINKA: Získanie odkazu na nastavenia turnaja
    const allRegistrationsLink = document.getElementById('all-registrations-link'); // NOVINKA: Získanie odkazu na všetky registrácie
    const mySettingsLink = document.getElementById('my-settings-link'); // NOVINKA: Získanie odkazu na moje nastavenia
    const allUsersLink = document.getElementById('all-users-link'); // NOVINKA: Získanie odkazu na moje nastavenia
    const notificationsLink = document.getElementById('notifications-link'); // NOVINKA: Získanie odkazu na upozornenia
    
    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button, textové elementy alebo menu spacer po vložení HTML.");
        return;
    }

    // Inicializujeme stav menu z dát používateľa alebo na false, ak nie je definovaný
    let isMenuToggled = userProfileData?.isMenuToggled || false;
    
    /**
     * Funkcia na aplikovanie stavu menu (pre počiatočné načítanie)
     */
    const applyMenuState = () => {
        if (isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
        } else {
            leftMenu.classList.remove('w-64');
            leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
        }
        menuTexts.forEach(span => {
            if (isMenuToggled) {
                span.classList.remove('opacity-0');
            } else {
                span.classList.add('opacity-0');
            }
        });
    };
    
    // Nová funkcia na dynamickú zmenu textu menu
    const updateMenuText = () => {
        const myDataLinkSpan = document.querySelector('a[href="logged-in-my-data.html"] .whitespace-nowrap');
        if (myDataLinkSpan) {
            if (userProfileData.role === 'user') {
                myDataLinkSpan.textContent = 'Kontaktná osoba';
            } else {
                myDataLinkSpan.textContent = 'Moje údaje';
            }
        }
    };
    
    // Funkcia na podmienené zobrazenie odkazov pre admina
    const showAdminLinks = () => {
        if (userProfileData.role === 'admin') {
            addCategoriesLink.classList.remove('hidden');
            tournamentSettingsLink.classList.remove('hidden'); 
            allRegistrationsLink.classList.remove('hidden');
            mySettingsLink.classList.remove('hidden'); // NOVINKA: Zobrazenie odkazu na moje nastavenia
            allUsersLink.classList.remove('hidden');
            notificationsLink.classList.remove('hidden'); // NOVINKA: Zobrazenie odkazu na upozornenia
        } else {
            addCategoriesLink.classList.add('hidden');
            tournamentSettingsLink.classList.add('hidden');
            allRegistrationsLink.classList.add('hidden');
            mySettingsLink.classList.add('hidden'); // NOVINKA: Skrytie odkazu na moje nastavenia
            notificationsLink.classList.add('hidden'); // NOVINKA: Skrytie odkazu na upozornenia
        }
    };    

    /**
     * Funkcia na uloženie stavu menu do databázy.
     */
    const saveMenuState = async () => {
        if (!userId) {
            console.error("left-menu.js: Upozornenie: Chýba ID používateľa. Stav menu nebude uložený.");
            return;
        }

        const userDocRef = doc(db, 'users', userId);
        try {
            await setDoc(userDocRef, { isMenuToggled }, { merge: true });
            console.log("left-menu.js: Stav menu bol úspešne uložený do databázy.");
        } catch (error) {
            console.error("left-menu.js: Chyba pri ukladaní/vytváraní stavu menu:", error);
            // Zobrazenie globálnej notifikácie, ak je funkcia dostupná
            if (window.showGlobalNotification) {
                 window.showGlobalNotification('Nepodarilo sa uložiť nastavenia menu. Skontrolujte oprávnenia.', 'error');
            }
        }
    };

    // Aplikujeme počiatočný stav menu pri načítaní
    applyMenuState();
    // Aplikujeme dynamický text menu
    updateMenuText();
    // Zobrazíme admin odkazy na základe roly
    showAdminLinks();
    
    // Obsluha kliknutia na tlačidlo
    menuToggleButton.addEventListener('click', () => {
        isMenuToggled = !isMenuToggled;
        applyMenuState();
        saveMenuState();
    });

    // Obsluha prechodu myšou pre automatické rozbalenie
    leftMenu.addEventListener('mouseenter', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
        }
    });

    leftMenu.addEventListener('mouseleave', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-64');
            leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
        }
    });
};

const loadLeftMenu = async (userProfileData) => {
    // Kontrola, či existujú dáta používateľa, bez nich nemá menu zmysel
    if (userProfileData && userProfileData.id) {
        const menuPlaceholder = document.getElementById('menu-placeholder');
        if (!menuPlaceholder) {
            console.error("left-menu.js: Nebol nájdený žiadny element s ID 'menu-placeholder'.");
            return;
        }

        try {
            const response = await fetch('logged-in-left-menu.html');
            if (!response.ok) {
                throw new Error(`HTTP chyba! Stav: ${response.status} ${response.statusText}`);
            }
            const menuHtml = await response.text();
            menuPlaceholder.innerHTML = menuHtml;
            console.log("left-in-left-menu-js: Obsah menu bol úspešne vložený do placeholderu.");

            // Po úspešnom vložení HTML hneď nastavíme poslucháčov
            const db = window.db;
            const userId = userProfileData.id;
            setupMenuListeners(userProfileData, db, userId);
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
    console.log('left-menu.js: Globálne dáta už existujú. Vykresľujem menu okamžite.');
    loadLeftMenu(window.globalUserProfileData);
}
