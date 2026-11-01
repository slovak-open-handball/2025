import { doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

window.registrationDates = null;
let timerId = null;
let countdownIntervalId = null; 
let hasCategories = false;

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

const isReallyLoggedIn = () => {
    if (!window.globalUserProfileData) return false;    
    if (window.isAnonymousUser === true) return false;    
    if (window.globalUserProfileData.role === 'anonymous') return false;    
    return true;
};

const updateRegistrationStatusText = (dates) => {
    const messageElement = document.getElementById('registration-status-message');
    if (!messageElement) {
        return;
    }
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
const updateLoginButton = (isLoggedIn) => {
    const loginLink = document.getElementById('login-button-wrapper');
    const loginButton = document.getElementById('login-button');
    if (loginLink && loginButton) {
        loginLink.style.display = 'none';        
        if (isLoggedIn) {
            loginLink.href = 'logged-in-my-data.html';
            loginButton.textContent = 'Moja zóna';
            const userRole = window.globalUserProfileData ? window.globalUserProfileData.role : null;
            const roleColor = getRoleColor(userRole);            
            loginButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = roleColor;
            loginButton.style.borderColor = roleColor;
        } else {
            loginLink.href = 'login.html';
            loginButton.textContent = 'Prihlásenie';
            loginButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = '';
        }        
        loginLink.style.display = 'inline-block';
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
            } else {
                window.registrationDates = null;
            }
            updateRegistrationStatusAndButtons();
        }, (error) => {
            window.registrationDates = null;
            updateRegistrationStatusAndButtons();
        });

    } catch (error) {
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
    } else {
        toggleLoggedInMessage(false);
        updateRegistrationStatusText(window.registrationDates);
    }
    updateLoginButton(isLoggedIn);
};
window.addEventListener('globalDataUpdated', () => {
    setupRegistrationDataListener();
});
