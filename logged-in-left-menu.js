import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const setupMenuListeners = (userProfileData, db, userId) => {
    const leftMenu = document.getElementById('left-menu');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const menuTexts = document.querySelectorAll('#left-menu .whitespace-nowrap');
    const menuIcon = document.querySelector('#menu-toggle-button svg');
    const menuText = document.querySelector('#menu-toggle-button .whitespace-nowrap');
    const menuSpacer = document.querySelector('#main-content-area > .flex-shrink-0');
    const addCategoriesLink = document.getElementById('add-categories-link');
    const addGroupsLink = document.getElementById('add-groups-link'); 
    const tournamentSettingsLink = document.getElementById('tournament-settings-link');
    const allRegistrationsLink = document.getElementById('all-registrations-link');
    const allUsersLink = document.getElementById('all-users-link');
    const notificationsLink = document.getElementById('notifications-link');
    const notificationsTextWithCount = document.getElementById('notifications-text-with-count');
    const notificationBadgeCount = document.getElementById('notification-badge-count');
    const teamRostersLink = document.getElementById('team-rosters-link');
    const teamsInGroupsLink = document.getElementById('teams-in-groups-link');
    const mapLink = document.getElementById('map-link'); 
    const teamsAccommodationLink = document.getElementById('teams-accommodation-link');
    
    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) {
        console.error("left-menu.js: Nepodarilo sa nájsť #left-menu, #menu-toggle-button, textové elementy alebo menu spacer po vložení HTML.");
        return;
    }

    let isMenuToggled = userProfileData?.isMenuToggled || false;
    
    const highlightActiveMenuLink = () => {
        const currentPath = window.location.pathname;
        const menuLinks = document.querySelectorAll('#left-menu a');
        const role = userProfileData?.role || 'default';
        
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
            const href = link.getAttribute('href');
            if (href) {
                link.classList.remove(
                    'bg-blue-100', 'dark:bg-blue-900', 
                    'text-blue-600', 'dark:text-blue-300',
                    'text-[#1F2937]', 'dark:text-[#1F2937]/90',
                    'bg-[#b06835]/20', 'dark:bg-[#b06835]/10',
                    'text-[#b06835]', 'dark:text-[#b06835]/80',
                    'bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10',
                    'text-[#9333EA]', 'dark:text-[#9333EA]/80',
                    'bg-[#007800]/20', 'dark:bg-[#007800]/10',
                    'text-[#007800]', 'dark:text-[#007800]/80',
                    'bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10',
                    'text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80',
                    'bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10',
                    'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80',
                    'text-white', 'dark:text-white',
                    'hover:text-white', 'hover:dark:text-white'
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
                    link.classList.add('bg-[#F9FAFB]', 'dark:bg-gray-800/30', 'text-[#1F2937]', 'dark:text-[#1F2937]/90');
                    link.classList.add('hover:text-white', 'hover:dark:text-white');
                }
            }
        });
    };

    const highlightActiveMenuLinkGray = () => {
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
                    'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80',
                    'text-[#1F2937]', 'dark:text-[#1F2937]/90',
                    'text-white', 'dark:text-white',
                    'hover:text-white', 'hover:dark:text-white'
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
                    link.classList.add('bg-[#F9FAFB]', 'dark:bg-gray-800/30', 'text-[#1F2937]', 'dark:text-[#1F2937]/90');
                    link.classList.add('hover:text-white', 'hover:dark:text-white');
                    
                    const icon = link.querySelector('svg');
                    if (icon) {
                        icon.style.color = '#1F2937';
                        icon.classList.add('dark:text-[#1F2937]/90');
                        icon.classList.add('hover:text-white', 'hover:dark:text-white');
                    }
                } else {
                    const icon = link.querySelector('svg');
                    if (icon) {
                        icon.style.color = '';
                        icon.classList.remove('dark:text-[#1F2937]/90');
                        icon.classList.remove('hover:text-white', 'hover:dark:text-white');
                    }
                }
            }
        });
    };

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

    const applyMenuState = () => {
        const role = userProfileData?.role || 'default';
        const roleColor = getColorForRole(role);

        if (isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
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
            if (menuIcon) {
                menuIcon.style.color = '';
            }
            if (menuText) {
                menuText.style.color = '';
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
            if (window.showGlobalNotification) {
                window.showGlobalNotification('Nepodarilo sa uložiť nastavenia menu. Skontrolujte oprávnenia.', 'error');
            }
        }
    };

    applyMenuState();
    updateMenuText();
    showRoleBasedLinks();
    setTimeout(highlightActiveMenuLinkGray, 100);
    
    menuToggleButton.addEventListener('click', () => {
        isMenuToggled = !isMenuToggled;
        applyMenuState();
        saveMenuState();
        setTimeout(highlightActiveMenuLinkGray, 300);
    });

    leftMenu.addEventListener('mouseenter', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-16');
            leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16');
            menuSpacer.classList.add('w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
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
        }
    });
};

const loadLeftMenu = async (userProfileData) => {
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

            const db = window.db;
            const userId = userProfileData.id;
            setupMenuListeners(userProfileData, db, userId);
            const leftMenuElement = document.getElementById('left-menu');
            if (leftMenuElement) {
                leftMenuElement.classList.remove('hidden');
            }

            window.addEventListener('popstate', () => {
                setTimeout(() => {
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
                                'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80',
                                'text-[#1F2937]', 'dark:text-[#1F2937]/90',
                                'text-white', 'dark:text-white',
                                'hover:text-white', 'hover:dark:text-white'
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
                                link.classList.add('bg-[#F9FAFB]', 'dark:bg-gray-800/30', 'text-[#1F2937]', 'dark:text-[#1F2937]/90');
                                link.classList.add('hover:text-white', 'hover:dark:text-white');
                                
                                const icon = link.querySelector('svg');
                                if (icon) {
                                    icon.style.color = '#1F2937';
                                    icon.classList.add('dark:text-[#1F2937]/90');
                                }
                            } else {
                                const icon = link.querySelector('svg');
                                if (icon) {
                                    icon.style.color = '';
                                    icon.classList.remove('dark:text-[#1F2937]/90');
                                }
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

const addCustomStyles = () => {
    if (!document.getElementById('left-menu-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'left-menu-custom-styles';
        style.textContent = `
            /* Animácia pre plynulý prechod farieb */
            #left-menu a {
                transition: background-color 200ms ease, color 200ms ease;
            }
            
            /* Animácia pre ikony */
            #left-menu a svg {
                transition: color 200ms ease;
            }
            
            /* #F9FAFB pozadie pre aktívny odkaz */
            .bg-\\[\\#F9FAFB\\] { background-color: #F9FAFB; }
            .dark .dark\\:bg-gray-800\\/30 { background-color: rgba(31, 41, 55, 0.3); }
            
            /* Farby textu #1F2937 */
            .text-\\[\\#1F2937\\] { color: #1F2937; }
            .dark .dark\\:text-\\[\\#1F2937\\]\\/90 { color: rgba(31, 41, 55, 0.9); }
            
            /* Biele texty pri hover na aktívnej stránke */
            .hover\\:text-white:hover { color: white; }
            .dark .hover\\:dark\\:text-white:hover { color: white; }
            
            /* Biele ikony pri hover na aktívnej stránke */
            #left-menu a:hover svg.hover\\:text-white {
                color: white !important;
            }
            .dark #left-menu a:hover svg.hover\\:dark\\:text-white {
                color: white !important;
            }
            
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

addCustomStyles();

window.addEventListener('globalDataUpdated', (event) => {
    console.log('left-menu.js: Prijatá udalosť "globalDataUpdated". Kontrolujem dáta...');
    loadLeftMenu(event.detail);
});

if (window.globalUserProfileData) {
    console.log('left-menu.js: Globálne dáta už existujú. Vykresľujem menu okamžite.');
    loadLeftMenu(window.globalUserProfileData);
}
