import { doc, onSnapshot, getDoc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
window.registrationDates = null;
let timerId = null;
let countdownIntervalId = null; 
let hasCategories = false;
let anyPagePublic = false;
const EXCLUDED_PAGES_FROM_HIDING = ['category-creation'];
const PAGE_BUTTON_DEFINITIONS = [
    { id: 'teams-in-groups', label: 'Skupiny', href: 'teams-in-groups' },
    { id: 'matches',         label: 'Zápasy',  href: 'matches' },
    { id: 'tables',          label: 'Tabuľky', href: 'tables' },
    { id: 'teams',           label: 'Tímy',    href: 'teams' },
    { id: 'catering',        label: 'Stravovanie', href: 'catering' },
    { id: 'transport',       label: 'Doprava', href: 'transport' },
    { id: 'statistics',      label: 'Štatistiky', href: 'statistics' },
    { id: 'map',             label: 'Mapa',    href: 'map' },
];
const formatDate = (timestamp) => {
    if (!timestamp) return 'Neurčený dátum';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `dňa&nbsp;${day}.&nbsp;${month}.&nbsp;${year}&nbsp;o&nbsp;${hours}:${minutes}&nbsp;hod.`;
};
const formatTournamentDate = (timestamp) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}. ${month}. ${year}`;
};
const isReallyLoggedIn = () => {
    if (!window.globalUserProfileData) return false;    
    if (window.isAnonymousUser === true) return false;    
    if (window.globalUserProfileData.role === 'anonymous') return false;    
    return true;
};
const logAllDatesFromData = (data, sourceLabel) => {
    if (!data) {
        return;
    }
    Object.entries(data).forEach(([key, value]) => {
        if (value && typeof value.toDate === 'function') {
            const d = value.toDate();
        }
    });
};
const renderTournamentDates = (dates) => {
    const heading =
        document.getElementById('tournament-title') ||
        document.querySelector('h1.tournament-title') ||
        Array.from(document.querySelectorAll('h1, h2')).find(el =>
            el.textContent.trim().toLowerCase().includes('slovak open handball')
        );
    if (!heading) return;
    let container = document.getElementById('tournament-dates-display');
    if (!container) {
        container = document.createElement('div');
        container.id = 'tournament-dates-display';
        container.className = 'text-gray-700 text-base md:text-lg mt-2 mb-3 font-medium';
        heading.insertAdjacentElement('afterend', container);
    }
    if (!dates || !dates.tournamentStart || !dates.tournamentEnd) {
        container.innerHTML = '';
        return;
    }
    const start = formatTournamentDate(dates.tournamentStart);
    const end = formatTournamentDate(dates.tournamentEnd);
    container.innerHTML = `
        <p>${start} &ndash; ${end}</p>
    `;
};
const renderPublicPageButtons = (pagesSnapshot) => {
    let container = document.getElementById('public-pages-buttons');
    if (!container) {
        container = document.createElement('div');
        container.id = 'public-pages-buttons';
        container.className = 'flex flex-wrap gap-3 my-4 justify-center';
        const messageElement = document.getElementById('registration-status-message');
        const heading =
            document.getElementById('tournament-title') ||
            document.querySelector('h1.tournament-title') ||
            Array.from(document.querySelectorAll('h1, h2')).find(el =>
                el.textContent.trim().toLowerCase().includes('slovak open handball')
            );
        if (messageElement && messageElement.parentNode) {
            messageElement.insertAdjacentElement('afterend', container);
        } else if (heading) {
            const datesContainer = document.getElementById('tournament-dates-display');
            if (datesContainer) {
                datesContainer.insertAdjacentElement('afterend', container);
            } else {
                heading.insertAdjacentElement('afterend', container);
            }
        } else {
            document.body.appendChild(container);
        }
    }
    const visibility = {};
    pagesSnapshot.forEach((pageDoc) => {
        const data = pageDoc.data();
        visibility[pageDoc.id] = data && data.visible === true;
    });
    const isPageVisible = (pageId) => {
        if (pageId === 'tables') {
            return visibility['matches'] === true;
        }
        if (pageId === 'teams') {
            return visibility['teams-in-groups'] === true;
        }
        if (pageId === 'statistics') {
            return visibility['rosters'] === true;
        }
        return visibility[pageId] === true;
    };
    container.innerHTML = '';
    const visiblePages = PAGE_BUTTON_DEFINITIONS.filter(def => isPageVisible(def.id));
    if (visiblePages.length === 0) {
        container.style.display = 'none';
        applyLoginButtonVisibility();
        return;
    }
    container.style.display = 'flex';
    visiblePages.forEach(def => {
        const a = document.createElement('a');
        a.href = def.href;
        a.textContent = def.label;
        a.className = 'inline-block px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors duration-200';
        container.appendChild(a);
    });
    applyLoginButtonVisibility();
};
const applyRegistrationVisibility = () => {
    const messageElement = document.getElementById('registration-status-message');
    if (!messageElement) return;
    if (anyPagePublic) {
        messageElement.classList.add('hidden');
        messageElement.innerHTML = '';
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    } else {
        messageElement.classList.remove('hidden');
    }
};
const updateRegistrationStatusText = (dates) => {
    const messageElement = document.getElementById('registration-status-message');
    if (!messageElement) {
        return;
    }
    if (anyPagePublic) {
        messageElement.classList.add('hidden');
        messageElement.innerHTML = '';
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
        return;
    }
    messageElement.classList.remove('hidden');
    if (!hasCategories) {
        messageElement.innerHTML = `
            <p class="text-red-600 font-semibold">Nie je možné sa zaregistrovať na turnaj Slovak Open Handball, pretože v systéme nie sú definované žiadne kategórie.</p>
        `;
        toggleRegistrationButton(false, 'no-categories');
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
        }
        return;
    }
    if (!dates || !dates.registrationStartDate || !dates.registrationEndDate) {
        messageElement.innerHTML = `<p class="text-gray-600">Informácie o registrácii nie sú momentálne dostupné.</p>`;
        toggleRegistrationButton(false);
        if (countdownIntervalId) {
            clearInterval(countdownIntervalId);
        }
        return;
    }
    const now = new Date();
    const registrationStart = dates.registrationStartDate.toDate();
    const registrationEnd = dates.registrationEndDate.toDate();
    if (now < registrationStart) {
        messageElement.innerHTML = `
            <p>Registrácia sa spustí ${formatDate(dates.registrationStartDate)}</p>
            <p id="countdown-timer" class="font-semibold text-gray-700"></p>
        `;
        startCountdown(registrationStart);
        toggleRegistrationButton(false, 'start');
    } else if (now >= registrationStart && now <= registrationEnd) {
        messageElement.innerHTML = `
            <p class="text-green-600 font-semibold">Registrácia je spustená!</p>
            <p>Končí ${formatDate(dates.registrationEndDate)}</p>
            <p id="countdown-timer" class="font-semibold text-gray-700"></p>
        `;
        startCountdown(registrationEnd);
        toggleRegistrationButton(true);
    } else {
        messageElement.innerHTML = `
            <p class="text-red-600 font-semibold">Registrácia na turnaj je už ukončená.</p>
            <p>Registrácia bola ukončená ${formatDate(dates.registrationEndDate)}</p>
        `;
        toggleRegistrationButton(false, 'end');
    }
};
const startCountdown = (targetDate) => {
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
    }
    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return;
    countdownIntervalId = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate.getTime() - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        if (distance < 0) {
            clearInterval(countdownIntervalId);
            timerElement.textContent = "Čas vypršal.";
            updateRegistrationStatusText(window.registrationDates);
        } else {
            timerElement.textContent = `Zostáva: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }, 1000);
};
const toggleRegistrationButton = (isVisible, reason = '') => {
    const buttonWrapper = document.getElementById('tournament-registration-button-wrapper');
    if (buttonWrapper) {
        buttonWrapper.style.display = isVisible ? 'inline-block' : 'none';
    }
};
const applyLoginButtonVisibility = () => {
    const loginLink = document.getElementById('login-button-wrapper');
    if (!loginLink) return;
    const container = document.getElementById('public-pages-buttons');
    const hasVisibleButtons = container && container.style.display !== 'none' &&
        container.querySelectorAll('a').length > 0;
    if (hasVisibleButtons) {
        loginLink.style.display = 'none';
    } else {
        if (typeof updateLoginButton === 'function') {
            updateLoginButton(isReallyLoggedIn());
        } else {
            loginLink.style.display = 'inline-block';
        }
    }
};
const updateLoginButton = (isLoggedIn) => {
    const loginLink = document.getElementById('login-button-wrapper');
    const loginButton = document.getElementById('login-button');
    if (loginLink && loginButton) {
        loginLink.style.display = 'none';        
        if (isLoggedIn) {
            loginLink.href = 'logged-in-my-data';
            loginButton.textContent = 'Moja zóna';
            const userRole = window.globalUserProfileData ? window.globalUserProfileData.role : null;
            const roleColor = getRoleColor(userRole);            
            loginButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = roleColor;
            loginButton.style.borderColor = roleColor;
        } else {
            loginLink.href = 'login';
            loginButton.textContent = 'Prihlásenie';
            loginButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = '';
        }
        const pagesContainer = document.getElementById('public-pages-buttons');
        const hasVisiblePages = pagesContainer &&
            pagesContainer.style.display !== 'none' &&
            pagesContainer.querySelectorAll('a').length > 0;
        if (hasVisiblePages) {
            loginLink.style.display = 'none';
        } else {
            loginLink.style.display = 'inline-block';
        }
    }
};
const getRoleColor = (role) => {
    const defaultColor = '#4299E1';
    switch (role) {
        case 'admin':
            return '#47b3ff'; 
        case 'hall':
            return '#b06835'; 
        case 'club':
            return '#9333EA'; 
        case 'volunteer':
            return '#FFAC1C';
        default:
            return defaultColor; 
    }
};
const toggleLoggedInMessage = (isLoggedIn, userProfileData) => {
    const loggedInMessage = document.getElementById('logged-in-message');
    if (loggedInMessage) {
        if (isLoggedIn && userProfileData && userProfileData.role !== 'anonymous') {
            const userName = `${userProfileData.firstName || ''} ${userProfileData.lastName || ''}`.trim();
            if (userName) {
                loggedInMessage.textContent = `Vitajte, ${userName}!`;
            } else {
                loggedInMessage.textContent = `Vitajte!`;
            }
            loggedInMessage.classList.remove('hidden');
        } else {
            loggedInMessage.classList.add('hidden');
        }
    }
};
const setupRegistrationDataListener = () => {
    try {
        if (!window.db) {
            return;
        }
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const categories = docSnap.data();
                hasCategories = Object.keys(categories).length > 0;
            } else {
                hasCategories = false; 
            }
            updateRegistrationStatusAndButtons();
        }, (error) => {
            hasCategories = false; 
            updateRegistrationStatusAndButtons();
        });
        const registrationDocRef = doc(window.db, "settings", "registration");
        onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
                logAllDatesFromData(window.registrationDates, 'settings/registration');
                renderTournamentDates(window.registrationDates);
            } else {
                window.registrationDates = null;
                renderTournamentDates(null);
            }
            updateRegistrationStatusAndButtons();
        }, (error) => {
            window.registrationDates = null;
            console.error('Chyba pri načítaní settings/registration:', error);
            renderTournamentDates(null);
            updateRegistrationStatusAndButtons();
        });
        const pagesRef = collection(window.db, "pages");
        onSnapshot(pagesRef, (snapshot) => {
            let anyPublic = false;
            snapshot.forEach((pageDoc) => {
                if (EXCLUDED_PAGES_FROM_HIDING.includes(pageDoc.id)) return;
                const data = pageDoc.data();
                if (data && data.visible === true) {
                    anyPublic = true;
                }
            });
            anyPagePublic = anyPublic;
            renderPublicPageButtons(snapshot);
            updateRegistrationStatusAndButtons();
        }, (error) => {
            console.error('Chyba pri načítaní kolekcie pages:', error);
            anyPagePublic = false;
            renderPublicPageButtons({ forEach: () => {} });
            updateRegistrationStatusAndButtons();
        });
    } catch (error) {
        console.error('Chyba v setupRegistrationDataListener:', error);
    }
};
const updateRegistrationStatusAndButtons = () => {
    const mainHeader = document.getElementById('header-placeholder')?.querySelector('header');
    if (mainHeader) {
        mainHeader.classList.remove('invisible');
    }
    const isLoggedIn = isReallyLoggedIn();
    if (isLoggedIn) {
        toggleLoggedInMessage(true, window.globalUserProfileData);
        toggleRegistrationButton(false);
        const messageElement = document.getElementById('registration-status-message');
        if (messageElement) messageElement.classList.add('hidden');
    } else {
        toggleLoggedInMessage(false);
        updateRegistrationStatusText(window.registrationDates);
    }
    updateLoginButton(isLoggedIn);
};
window.addEventListener('globalDataUpdated', () => {
    setupRegistrationDataListener();
});
