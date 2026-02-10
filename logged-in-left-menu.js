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
    
    // NOVINKA: Funkcia na zvýraznenie aktívneho odkazu v menu
    const highlightActiveMenuLink = () => {
        const currentPath = window.location.pathname;
        const menuLinks = document.querySelectorAll('#left-menu a');
        const role = userProfileData?.role || 'default';
        
        // Definícia farieb pre pozadie (bledšie) a text (plné farby) podľa roly
        const getRoleColors = (role) => {
            switch (role) {
                case 'admin':
                    return { 
                        bgClasses: ['bg-blue-100', 'dark:bg-blue-900/30'], 
                        textClasses: ['text-blue-600', 'dark:text-blue-400']
                    };
                case 'hall':
                    return { 
                        bgClasses: ['bg-[#b06835]/20', 'dark:bg-[#b06835]/10'], 
                        textClasses: ['text-[#b06835]', 'dark:text-[#b06835]/80']
                    };
                case 'club':
                    return { 
                        bgClasses: ['bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10'], 
                        textClasses: ['text-[#9333EA]', 'dark:text-[#9333EA]/80']
                    };
                case 'referee':
                    return { 
                        bgClasses: ['bg-[#007800]/20', 'dark:bg-[#007800]/10'], 
                        textClasses: ['text-[#007800]', 'dark:text-[#007800]/80']
                    };
                case 'volunteer':
                    return { 
                        bgClasses: ['bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10'], 
                        textClasses: ['text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80']
                    };
                default:
                    return { 
                        bgClasses: ['bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10'], 
                        textClasses: ['text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80']
                    };
            }
        };
        
        const roleColors = getRoleColors(role);

        menuLinks.forEach(link => {
            // Získanie cesty z href atribútu
            const href = link.getAttribute('href');
            if (href) {
                // Odstránenie všetkých farieb pozadia a textu
                link.classList.remove(
                    'bg-blue-100', 'dark:bg-blue-900', 
                    'text-blue-600', 'dark:text-blue-300',
                    'bg-[#b06835]/20', 'dark:bg-[#b06835]/10',
                    'text-[#b06835]', 'dark:text-[#b06835]/80',
                    'bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10',
                    'text-[#9333EA]', 'dark:text-[#9333EA]/80',
                    'bg-[#007800]/20', 'dark:bg-[#007800]/10',
                    'text-[#007800]', 'dark:text-[#007800]/80',
                    'bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10',
                    'text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80',
                    'bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10',
                    'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80'
                );
                
                // Kontrola, či aktuálna stránka zodpovedá href odkazu
                if (currentPath.includes(href) || 
                    (href === 'logged-in-my-data.html' && currentPath.includes('my-data')) ||
                    (href === 'logged-in-rosters.html' && currentPath.includes('rosters')) ||
                    (href === 'logged-in-add-categories.html' && currentPath.includes('add-categories')) ||
                    (href === 'logged-in-add-groups.html' && currentPath.includes('add-groups')) ||
                    (href === 'logged-in-teams-in-accommodation.html' && currentPath.includes('teams-in-accommodation')) ||
                    (href === 'logged-in-map.html' && currentPath.includes('map')) ||
                    (href === 'logged-in-tournament-settings.html' && currentPath.includes('logged-in-tournament-settings')) ||
                    (href === 'logged-in-all-registrations.html' && currentPath.includes('all-registrations')) ||
                    (href === 'logged-in-users.html' && currentPath.includes('users')) ||                       
                    (href === 'logged-in-notifications.html' && currentPath.includes('notifications'))) {
                    // Pridanie farieb pozadia a textu podľa roly - každú triedu zvlášť
                    link.classList.add(...roleColors.bgClasses, ...roleColors.textClasses);
                }
            }
        });
    };

    // NOVINKA: Funkcia na zvýraznenie aktívneho odkazu v menu - BLEDOSIVÉ POZADIE PRE VŠETKÝCH
    const highlightActiveMenuLinkGray = () => {
        const currentPath = window.location.pathname;
        const menuLinks = document.querySelectorAll('#left-menu a');

        menuLinks.forEach(link => {
            // Získanie cesty z href atribútu
            const href = link.getAttribute('href');
            if (href) {
                // Odstránenie všetkých farieb pozadia a textu
                link.classList.remove(
                    'bg-blue-100', 'dark:bg-blue-900', 
                    'text-blue-600', 'dark:text-blue-300',
                    'bg-[#b06835]/20', 'dark:bg-[#b06835]/10',
                    'text-[#b06835]', 'dark:text-[#b06835]/80',
                    'bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10',
                    'text-[#9333EA]', 'dark:text-[#9333EA]/80',
                    'bg-[#007800]/20', 'dark:bg-[#007800]/10',
                    'text-[#007800]', 'dark:text-[#007800]/80',
                    'bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10',
                    'text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80',
                    'bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10',
                    'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80'
                );
                
                // Kontrola, či aktuálna stránka zodpovedá href odkazu
                if (currentPath.includes(href) || 
                    (href === 'logged-in-my-data.html' && currentPath.includes('my-data')) ||
                    (href === 'logged-in-rosters.html' && currentPath.includes('rosters')) ||
                    (href === 'logged-in-add-categories.html' && currentPath.includes('add-categories')) ||
                    (href === 'logged-in-add-groups.html' && currentPath.includes('add-groups')) ||
                    (href === 'logged-in-teams-in-accommodation.html' && currentPath.includes('teams-in-accommodation')) ||
                    (href === 'logged-in-map.html' && currentPath.includes('map')) ||
                    (href === 'logged-in-tournament-settings.html' && currentPath.includes('logged-in-tournament-settings')) ||
                    (href === 'logged-in-all-registrations.html' && currentPath.includes('all-registrations')) ||
                    (href === 'logged-in-users.html' && currentPath.includes('users')) ||                       
                    (href === 'logged-in-notifications.html' && currentPath.includes('notifications'))) {
                    // Pridanie bledosivého pozadia pre všetkých
                    link.classList.add('bg-gray-100', 'dark:bg-gray-700/30');
                }
            }
        });
    };

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
            teamsAccommodationLink?.classList.add('hidden');
            
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
            teamsAccommodationLink?.classList.add('hidden');
            
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
    // Zvýrazníme aktívny odkaz - POUŽIJEME BLEDOSIVÉ POZADIE
    setTimeout(highlightActiveMenuLinkGray, 100);
    
    // Obsluha kliknutia na tlačidlo
    menuToggleButton.addEventListener('click', () => {
        isMenuToggled = !isMenuToggled;
        applyMenuState();
        saveMenuState();
        // Re-apply highlighting after menu animation completes - POUŽIJEME BLEDOSIVÉ POZADIE
        setTimeout(highlightActiveMenuLinkGray, 300);
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
            // Aktualizovať zvýraznenie - POUŽIJEME BLEDOSIVÉ POZADIE
            setTimeout(highlightActiveMenuLinkGray, 100);
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

            // Pridanie event listener pre zmenu stránky (popstate)
            window.addEventListener('popstate', () => {
                setTimeout(() => {
                    // Znovu inicializovať zvýraznenie menu po zmene stránky - POUŽIJEME BLEDOSIVÉ POZADIE
                    const currentPath = window.location.pathname;
                    const menuLinks = document.querySelectorAll('#left-menu a');

                    menuLinks.forEach(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            link.classList.remove(
                                'bg-blue-100', 'dark:bg-blue-900', 
                                'text-blue-600', 'dark:text-blue-300',
                                'bg-[#b06835]/20', 'dark:bg-[#b06835]/10',
                                'text-[#b06835]', 'dark:text-[#b06835]/80',
                                'bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10',
                                'text-[#9333EA]', 'dark:text-[#9333EA]/80',
                                'bg-[#007800]/20', 'dark:bg-[#007800]/10',
                                'text-[#007800]', 'dark:text-[#007800]/80',
                                'bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10',
                                'text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80',
                                'bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10',
                                'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80'
                            );
                            
                            if (currentPath.includes(href) || 
                                (href === 'logged-in-my-data.html' && currentPath.includes('my-data')) ||
                                (href === 'logged-in-rosters.html' && currentPath.includes('rosters')) ||
                                (href === 'logged-in-add-categories.html' && currentPath.includes('add-categories')) ||
                                (href === 'logged-in-add-groups.html' && currentPath.includes('add-groups')) ||
                                (href === 'logged-in-teams-in-accommodation.html' && currentPath.includes('teams-in-accommodation')) ||
                                (href === 'logged-in-map.html' && currentPath.includes('map')) ||
                                (href === 'logged-in-tournament-settings.html' && currentPath.includes('logged-in-tournament-settings')) ||
                                (href === 'logged-in-all-registrations.html' && currentPath.includes('all-registrations')) ||
                                (href === 'logged-in-users.html' && currentPath.includes('users')) ||                       
                                (href === 'logged-in-notifications.html' && currentPath.includes('notifications'))) {
                                // Pridanie bledosivého pozadia pre všetkých
                                link.classList.add('bg-gray-100', 'dark:bg-gray-700/30');
                            }
                        }
                    });
                }, 100);
            });

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

// Pridanie CSS štýlov pre lepšiu podporu premenlivých farieb
const addCustomStyles = () => {
    if (!document.getElementById('left-menu-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'left-menu-custom-styles';
        style.textContent = `
            /* Animácia pre plynulý prechod farieb */
            #left-menu a {
                transition: background-color 200ms ease, color 200ms ease;
            }
            
            /* Bledosivé pozadie pre aktívny odkaz */
            .bg-gray-100 { background-color: rgba(243, 244, 246, 1); }
            .dark .dark\\:bg-gray-700\\/30 { background-color: rgba(55, 65, 81, 0.3); }
            
            /* Bledšie farby pozadia pre rôzne roly */
            .bg-\\[\\#b06835\\]\\/20 { background-color: rgba(176, 104, 53, 0.2); }
            .dark .dark\\:bg-\\[\\#b06835\\]\\/10 { background-color: rgba(176, 104, 53, 0.1); }
            
            .bg-\\[\\#9333EA\\]\\/20 { background-color: rgba(147, 51, 234, 0.2); }
            .dark .dark\\:bg-\\[\\#9333EA\\]\\/10 { background-color: rgba(147, 51, 234, 0.1); }
            
            .bg-\\[\\#007800\\]\\/20 { background-color: rgba(0, 120, 0, 0.2); }
            .dark .dark\\:bg-\\[\\#007800\\]\\/10 { background-color: rgba(0, 120, 0, 0.1); }
            
            .bg-\\[\\#FFAC1C\\]\\/20 { background-color: rgba(255, 172, 28, 0.2); }
            .dark .dark\\:bg-\\[\\#FFAC1C\\]\\/10 { background-color: rgba(255, 172, 28, 0.1); }
            
            .bg-\\[\\#1D4ED8\\]\\/20 { background-color: rgba(29, 78, 216, 0.2); }
            .dark .dark\\:bg-\\[\\#1D4ED8\\]\\/10 { background-color: rgba(29, 78, 216, 0.1); }
            
            /* Farby textu pre rôzne roly */
            .text-\\[\\#b06835\\] { color: #b06835; }
            .dark .dark\\:text-\\[\\#b06835\\]\\/80 { color: rgba(176, 104, 53, 0.8); }
            
            .text-\\[\\#9333EA\\] { color: #9333EA; }
            .dark .dark\\:text-\\[\\#9333EA\\]\\/80 { color: rgba(147, 51, 234, 0.8); }
            
            .text-\\[\\#007800\\] { color: #007800; }
            .dark .dark\\:text-\\[\\#007800\\]\\/80 { color: rgba(0, 120, 0, 0.8); }
            
            .text-\\[\\#FFAC1C\\] { color: #FFAC1C; }
            .dark .dark\\:text-\\[\\#FFAC1C\\]\\/80 { color: rgba(255, 172, 28, 0.8); }
            
            .text-\\[\\#1D4ED8\\] { color: #1D4ED8; }
            .dark .dark\\:text-\\[\\#1D4ED8\\]\\/80 { color: rgba(29, 78, 216, 0.8); }
        `;
        document.head.appendChild(style);
    }
};

// Pripočítame CSS štýly hneď po načítaní
addCustomStyles();

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
