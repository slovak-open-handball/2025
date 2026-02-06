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
    const menuIcon = document.querySelector('#menu-toggle-button svg'); // NOVINKA: Získanie SVG ikony
    const menuText = document.querySelector('#menu-toggle-button .whitespace-nowrap'); // NOVINKA: Získanie textu "Menu"
    const menuSpacer = document.querySelector('#main-content-area > .flex-shrink-0'); // Nový element, ktorý sledujeme
    const addCategoriesLink = document.getElementById('add-categories-link'); // Získanie odkazu na kategórie
    const addGroupsLink = document.getElementById('add-groups-link'); // NOVINKA: Získanie odkazu na skupiny
    const tournamentSettingsLink = document.getElementById('tournament-settings-link'); // NOVINKA: Získanie odkazu na nastavenia turnaja
    const allRegistrationsLink = document.getElementById('all-registrations-link'); // NOVINKA: Získanie odkazu na všetky registrácie
    const allUsersLink = document.getElementById('all-users-link'); // NOVINKA: Získanie odkazu na moje nastavenia
    const notificationsLink = document.getElementById('notifications-link'); // NOVINKA: Získanie odkazu na upozornenia
    const notificationsTextWithCount = document.getElementById('notifications-text-with-count'); // NOVINKA: Získanie elementu pre text Upozornenia s počtom
    const notificationBadgeCount = document.getElementById('notification-badge-count'); // NOVINKA: Získanie elementu pre červený krúžok s počtom
    const teamRostersLink = document.getElementById('team-rosters-link'); // NOVINKA: Získanie odkazu na súpisku tímov
    const teamsInGroupsLink = document.getElementById('teams-in-groups-link'); // NOVINKA: Získanie odkazu na Tímy do skupín
    const mapLink = document.getElementById('map-link'); // NOVINKA: Odkaz na mapu
    const teamsAccommodationLink = document.getElementById('teams-accommodation-link');
    
    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button, textové elementy alebo menu spacer po vložení HTML.");
        return;
    }

    // Inicializujeme stav menu z dát používateľa alebo na false, ak nie je definovaný
    let isMenuToggled = userProfileData?.isMenuToggled || false;
    
    // NOVINKA: Funkcia na získanie farby podľa roly
    const getColorForRole = (role) => {
        switch (role) {
            case 'admin':
                return '#47b3ff';
            case 'hall':
                return '#b06835';
            case 'club':
                return '#9333EA';
            case 'referee':
                return '#007800';
            case 'volunteer':
                return '#FFAC1C';
            default:
                return '#1D4ED8';
        }
    };

    /**
     * Funkcia na aplikovanie stavu menu (pre počiatočné načítanie)
     */
    const applyMenuState = () => {
        const role = userProfileData?.role || 'default';
        const roleColor = getColorForRole(role);

        if (isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
            // NOVINKA: Nastavenie farby ikony a textu v rozbalenom stave
            if (menuIcon) {
                menuIcon.style.color = roleColor;
            }
            if (menuText) {
                menuText.style.color = roleColor;
            }
        } else {
            leftMenu.classList.remove('w-64');
            leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
            // NOVINKA: Reset farby v zbalenom stave
            if (menuIcon) {
                menuIcon.style.color = ''; // Reset na pôvodnú farbu
            }
            if (menuText) {
                menuText.style.color = ''; // Reset na pôvodnú farbu
            }
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
            if (userProfileData.role === 'club') {
                myDataLinkSpan.textContent = 'Kontaktná osoba';
            } else {
                myDataLinkSpan.textContent = 'Moje údaje';
            }
        }
    };
    
    // Funkcia na podmienené zobrazenie odkazov pre admina a používateľa
    const showRoleBasedLinks = () => {
        if (userProfileData.role === 'admin') {
            addCategoriesLink.classList.remove('hidden');
            addGroupsLink.classList.remove('hidden');
            tournamentSettingsLink.classList.remove('hidden');    
            allRegistrationsLink.classList.remove('hidden');
            allUsersLink.classList.remove('hidden');
            notificationsLink.classList.remove('hidden');
            teamRostersLink.classList.add('hidden');
            teamsInGroupsLink.classList.remove('hidden');
            mapLink?.classList.remove('hidden');
            teamsAccommodationLink?.classList.remove('hidden');

            const unreadCount = userProfileData.unreadNotificationCount || 0;
            if (notificationsTextWithCount) {
                if (unreadCount > 0) {
                    notificationsTextWithCount.textContent = `Upozornenia (${unreadCount})`;
                } else {
                    notificationsTextWithCount.textContent = 'Upozornenia';
                }
            }

            if (notificationBadgeCount) {
                if (unreadCount > 0) {
                    notificationBadgeCount.textContent = unreadCount.toString();
                    notificationBadgeCount.classList.remove('hidden');
                } else {
                    notificationBadgeCount.classList.add('hidden');
                }
            }

        } else if (userProfileData.role === 'club') {
            addCategoriesLink.classList.add('hidden');
            addGroupsLink.classList.add('hidden');
            tournamentSettingsLink.classList.add('hidden');
            allRegistrationsLink.classList.add('hidden');
            allUsersLink.classList.add('hidden');
            notificationsLink.classList.add('hidden');
            teamRostersLink.classList.remove('hidden');
            teamsInGroupsLink.classList.add('hidden'); 
            mapLink?.classList.add('hidden');
            teamsAccommodationLink?.classList.remove('hidden');
            
            if (notificationsTextWithCount) {
                notificationsTextWithCount.textContent = 'Upozornenia';
            }
            if (notificationBadgeCount) {
                notificationBadgeCount.classList.add('hidden');
            }
        } else {
            // Predvolene skryť všetky špecifické odkazy, ak rola nie je admin ani user
            addCategoriesLink.classList.add('hidden');
            addGroupsLink.classList.add('hidden');
            tournamentSettingsLink.classList.add('hidden');
            allRegistrationsLink.classList.add('hidden');
            allUsersLink.classList.add('hidden');
            notificationsLink.classList.add('hidden');
            teamRostersLink.classList.add('hidden');
            teamsInGroupsLink.classList.add('hidden');
            mapLink?.classList.add('hidden');
            teamsAccommodationLink?.classList.remove('hidden');
            
            if (notificationsTextWithCount) {
                notificationsTextWithCount.textContent = 'Upozornenia';
            }
            if (notificationBadgeCount) {
                notificationBadgeCount.classList.add('hidden');
            }
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
    // Zobrazíme odkazy na základe roly
    showRoleBasedLinks();
    
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
            // Zrušenie zmeny farby textu "Menu" pri mouseenter, keď je zbalené
        }
    });

    leftMenu.addEventListener('mouseleave', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-64');
            leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64');
            menuSpacer.classList.add('w-16');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
            // Zrušenie resetu farby textu "Menu" pri mouseleave, keď je zbalené
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
            console.log("logged-in-left-menu-js: Obsah menu bol úspešne vložený do placeholderu.");

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
