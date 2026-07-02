import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const loadLeftMenu = async (userProfileData) => {
    if (userProfileData && userProfileData.id) {
        const menuPlaceholder = document.getElementById('menu-placeholder');
        if (!menuPlaceholder) return;
        try {
            const response = await fetch('logged-in-left-menu.html');
            if (!response.ok) throw new Error(`HTTP chyba! Stav: ${response.status}`);
          
            const menuHtml = await response.text();
            menuPlaceholder.innerHTML = menuHtml;
            const db = window.db;
            const userId = userProfileData.id;
            setupMenuListeners(userProfileData, db, userId);
            const leftMenuElement = document.getElementById('left-menu');
            if (leftMenuElement) leftMenuElement.classList.remove('hidden');
        } catch (error) {
            console.error('Chyba pri načítaní menu:', error);
        }
    } else {
        const leftMenuElement = document.getElementById('left-menu');
        if (leftMenuElement) leftMenuElement.classList.add('hidden');
    }
};

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
    const matchesLink = document.getElementById('matches-link');
    const matchesHallLink = document.getElementById('matches-hall-link');
    const cateringLink = document.getElementById('catering-link');

    if (!leftMenu || !menuToggleButton || menuTexts.length === 0 || !menuSpacer) return;

    let isMenuToggled = userProfileData?.isMenuToggled || false;

    const highlightActiveMenuLinkGray = () => {
        const currentPath = window.location.pathname;
        const menuLinks = document.querySelectorAll('#left-menu a');
    
        menuLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            link.classList.remove(
                'bg-blue-100', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-300',
                'bg-[#b06835]/20', 'dark:bg-[#b06835]/10', 'text-[#b06835]', 'dark:text-[#b06835]/80',
                'bg-[#9333EA]/20', 'dark:bg-[#9333EA]/10', 'text-[#9333EA]', 'dark:text-[#9333EA]/80',
                'bg-[#007800]/20', 'dark:bg-[#007800]/10', 'text-[#007800]', 'dark:text-[#007800]/80',
                'bg-[#FFAC1C]/20', 'dark:bg-[#FFAC1C]/10', 'text-[#FFAC1C]', 'dark:text-[#FFAC1C]/80',
                'bg-[#1D4ED8]/20', 'dark:bg-[#1D4ED8]/10', 'text-[#1D4ED8]', 'dark:text-[#1D4ED8]/80',
                'text-[#1F2937]', 'dark:text-[#1F2937]/90', 'text-white', 'dark:text-white',
                'hover:text-white', 'hover:dark:text-white'
            );

            const isActive = currentPath.includes(href) ||
                (href === 'logged-in-my-data.html' && currentPath.includes('my-data')) ||
                (href === 'logged-in-rosters.html' && currentPath.includes('rosters')) ||
                (href === 'logged-in-add-categories.html' && currentPath.includes('add-categories')) ||
                (href === 'logged-in-add-groups.html' && currentPath.includes('add-groups')) ||
                (href === 'logged-in-teams-in-accommodation.html' && currentPath.includes('teams-in-accommodation')) ||
                (href === 'logged-in-map.html' && currentPath.includes('map')) ||
                (href === 'logged-in-tournament-settings.html' && currentPath.includes('logged-in-tournament-settings')) ||
                (href === 'logged-in-all-registrations.html' && currentPath.includes('all-registrations')) ||
                (href === 'logged-in-users.html' && currentPath.includes('users')) ||
                (href === 'logged-in-notifications.html' && currentPath.includes('notifications')) ||
                (href === 'logged-in-catering.html' && currentPath.includes('catering'));

            if (isActive) {
                link.classList.add('bg-[#F9FAFB]', 'dark:bg-gray-800/30', 'text-[#1F2937]', 'dark:text-[#1F2937]/90');
            }
        });
    };

    const getColorForRole = (role) => {
        switch (role) {
            case 'admin': return '#47b3ff';
            case 'hall': return '#b06835';
            case 'club': return '#9333EA';
            case 'referee': return '#007800';
            case 'volunteer': return '#FFAC1C';
            default: return '#1D4ED8';
        }
    };

    const applyMenuState = () => {
        const role = userProfileData?.role || 'default';
        const roleColor = getColorForRole(role);
        if (isMenuToggled) {
            leftMenu.classList.remove('w-16'); leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16'); menuSpacer.classList.add('w-64');
            if (menuIcon) menuIcon.style.color = roleColor;
            if (menuText) menuText.style.color = roleColor;
        } else {
            leftMenu.classList.remove('w-64'); leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64'); menuSpacer.classList.add('w-16');
            if (menuIcon) menuIcon.style.color = '';
            if (menuText) menuText.style.color = '';
        }
        menuTexts.forEach(span => span.classList.toggle('opacity-0', !isMenuToggled));
    };

    const updateMenuText = () => {
        const myDataLinkSpan = document.querySelector('a[href="logged-in-my-data.html"] .whitespace-nowrap');
        if (myDataLinkSpan) {
            myDataLinkSpan.textContent = userProfileData.role === 'club' ? 'Kontaktná osoba' : 'Moje údaje';
        }
    };

    const showRoleBasedLinks = () => {
        if (userProfileData.role === 'admin') {
            addCategoriesLink?.classList.remove('hidden');
            addGroupsLink?.classList.remove('hidden');
            tournamentSettingsLink?.classList.remove('hidden');
            allRegistrationsLink?.classList.remove('hidden');
            allUsersLink?.classList.remove('hidden');
            notificationsLink?.classList.remove('hidden');
            teamRostersLink?.classList.add('hidden');
            teamsInGroupsLink?.classList.remove('hidden');
            mapLink?.classList.remove('hidden');
            teamsAccommodationLink?.classList.remove('hidden');
            matchesLink?.classList.remove('hidden');
            matchesHallLink?.classList.add('hidden');
            cateringLink?.classList.remove('hidden');
        } else if (userProfileData.role === 'club') {
            addCategoriesLink?.classList.add('hidden');
            addGroupsLink?.classList.add('hidden');
            tournamentSettingsLink?.classList.add('hidden');
            allRegistrationsLink?.classList.add('hidden');
            allUsersLink?.classList.add('hidden');
            notificationsLink?.classList.add('hidden');
            teamRostersLink?.classList.remove('hidden');
            teamsInGroupsLink?.classList.add('hidden');
            mapLink?.classList.add('hidden');
            teamsAccommodationLink?.classList.add('hidden');
            matchesLink?.classList.add('hidden');
            matchesHallLink?.classList.add('hidden');
            cateringLink?.classList.add('hidden');
        } else if (userProfileData.role === 'hall') {
            addCategoriesLink?.classList.add('hidden');
            addGroupsLink?.classList.add('hidden');
            tournamentSettingsLink?.classList.add('hidden');
            allRegistrationsLink?.classList.add('hidden');
            allUsersLink?.classList.add('hidden');
            notificationsLink?.classList.add('hidden');
            teamRostersLink?.classList.add('hidden');
            teamsInGroupsLink?.classList.add('hidden');
            mapLink?.classList.add('hidden');
            teamsAccommodationLink?.classList.add('hidden');
            matchesLink?.classList.add('hidden');
            matchesHallLink?.classList.remove('hidden');
            cateringLink?.classList.add('hidden');
        } else {
            addCategoriesLink?.classList.add('hidden');
            addGroupsLink?.classList.add('hidden');
            tournamentSettingsLink?.classList.add('hidden');
            allRegistrationsLink?.classList.add('hidden');
            allUsersLink?.classList.add('hidden');
            notificationsLink?.classList.add('hidden');
            teamRostersLink?.classList.add('hidden');
            teamsInGroupsLink?.classList.add('hidden');
            mapLink?.classList.add('hidden');
            teamsAccommodationLink?.classList.add('hidden');
            matchesLink?.classList.add('hidden');
            matchesHallLink?.classList.add('hidden');
            cateringLink?.classList.add('hidden');
        }
    };

    const saveMenuState = async () => {
        if (!userId) return;
        const userDocRef = doc(db, 'users', userId);
        try {
            await setDoc(userDocRef, { isMenuToggled }, { merge: true });
        } catch (error) {
            window.showGlobalNotification?.('Nepodarilo sa uložiť nastavenia menu.', 'error');
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
            leftMenu.classList.remove('w-16'); leftMenu.classList.add('w-64');
            menuSpacer.classList.remove('w-16'); menuSpacer.classList.add('w-64');
            menuTexts.forEach(span => span.classList.remove('opacity-0'));
            setTimeout(highlightActiveMenuLinkGray, 100);
        }
    });

    leftMenu.addEventListener('mouseleave', () => {
        if (!isMenuToggled) {
            leftMenu.classList.remove('w-64'); leftMenu.classList.add('w-16');
            menuSpacer.classList.remove('w-64'); menuSpacer.classList.add('w-16');
            menuTexts.forEach(span => span.classList.add('opacity-0'));
        }
    });
};

const addCustomStyles = () => {
    if (document.getElementById('left-menu-custom-styles')) return;

    const style = document.createElement('style');
    style.id = 'left-menu-custom-styles';
    style.textContent = `
        #left-menu a {
            transition: background-color 200ms ease, color 200ms ease;
        }
        #left-menu a svg {
            transition: color 200ms ease;
        }

        /* Hover pre všetky riadky (vrátane aktívnych) */
        #left-menu a:hover {
            background-color: #374151 !important;
        }

        /* Aktívny riadok má prioritu bez hoveru */
        #left-menu a.bg-\\[\\#F9FAFB\\],
        #left-menu a.dark\\:bg-gray-800\\/30 {
            background-color: #F9FAFB !important;
        }
        .dark #left-menu a.dark\\:bg-gray-800\\/30 {
            background-color: rgba(31, 41, 55, 0.3) !important;
        }

        /* Zachovanie farby textu pri hover */
        #left-menu a:hover,
        #left-menu a:hover .whitespace-nowrap,
        #left-menu a:hover svg {
            color: inherit !important;
        }
    `;
    document.head.appendChild(style);
};

addCustomStyles();

// Globálne volania
window.addEventListener('globalDataUpdated', (event) => loadLeftMenu(event.detail));
if (window.globalUserProfileData) {
    loadLeftMenu(window.globalUserProfileData);
}
