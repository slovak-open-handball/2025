// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// a podmienečne zobrazil tlačidlá a text na základe existencie kategórií a aktuálneho dátumu.
// Bola pridaná funkcia pre automatickú kontrolu času registrácie a odpočet.
// Pridaná bola aj logika pre zmenu textu a presmerovania tlačidla na základe stavu prihlásenia.
// Upravená bola aj funkcia na zmenu farby tlačidla "Moja zóna" podľa role používateľa.
// Predvolene sú tlačidlá 'Prihlásenie' a 'Registrácia na turnaj' skryté.

import { doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Globálna premenná na uloženie dát o registrácii
window.registrationDates = null;
let timerId = null; // ID pre časovač, aby sme ho mohli zrušiť
let countdownIntervalId = null; // ID pre interval odpočtu

/**
 * Pomocná funkcia na formátovanie objektu Timestamp do čitateľného reťazca "dňa dd. mm. yyyy o hh:mm hod.".
 * Používa nezalomiteľné medzery (&nbsp;), aby sa zabránilo zalomeniu riadka v dátume.
 * @param {import('firebase/firestore').Timestamp} timestamp - Objekt Timestamp z Firestore.
 * @returns {string} Formátovaný dátum a čas.
 */
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

/**
 * Aktualizuje stav registrácie a logiky pre tlačidlá na základe dátumov.
 * @param {object} dates - Objekt s dátumami začiatku a konca registrácie.
 */
const updateRegistrationStatusText = (dates) => {
    // Upravená podmienka na kontrolu existencie správne pomenovaných polí.
    if (!dates || !dates.registrationStartDate || !dates.registrationEndDate) {
        console.warn("Dáta o registrácii (registrationStartDate alebo registrationEndDate) nie sú k dispozícii alebo sú neúplné.");
        return;
    }

    const now = new Date();
    const registrationStart = dates.registrationStartDate.toDate();
    const registrationEnd = dates.registrationEndDate.toDate();
    const messageElement = document.getElementById('registration-status-message');

    if (!messageElement) {
        console.warn("Element #registration-status-message nebol nájdený.");
        return;
    }

    if (now < registrationStart) {
        // Registrácia sa ešte nezačala
        messageElement.innerHTML = `
            <p>Registrácia sa spustí ${formatDate(dates.registrationStartDate)}</p>
            <p id="countdown-timer" class="font-semibold text-gray-700"></p>
        `;
        startCountdown(registrationStart);
        toggleRegistrationButton(false, 'start');
    } else if (now >= registrationStart && now <= registrationEnd) {
        // Registrácia je spustená
        messageElement.innerHTML = `
            <p class="text-green-600 font-semibold">Registrácia je spustená!</p>
            <p>Končí ${formatDate(dates.registrationEndDate)}.</p>
            <p id="countdown-timer" class="font-semibold text-gray-700"></p>
        `;
        startCountdown(registrationEnd);
        toggleRegistrationButton(true);
    } else {
        // Registrácia je už ukončená
        messageElement.innerHTML = `
            <p class="text-red-600 font-semibold">Registrácia na turnaj je už ukončená.</p>
            <p>Registrácia bola ukončená ${formatDate(dates.registrationEndDate)}</p>
        `;
        toggleRegistrationButton(false, 'end');
    }
};

/**
 * Spustí odpočet času do určeného dátumu.
 * @param {Date} targetDate - Dátum, do ktorého sa má odpočet počítať.
 */
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
            updateRegistrationStatusText(window.registrationDates); // Znovu skontrolujeme stav registrácie
        } else {
            timerElement.textContent = `Zostáva: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }, 1000);
};

/**
 * Prepína viditeľnosť tlačidla "Registrácia na turnaj".
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 * @param {string} [reason] - Dôvod pre skrytie (napr. 'start' pre ešte nezačatú registráciu).
 */
const toggleRegistrationButton = (isVisible, reason = '') => {
    const buttonWrapper = document.getElementById('tournament-registration-button-wrapper');
    if (buttonWrapper) {
        buttonWrapper.style.display = isVisible ? 'inline-block' : 'none';
        console.log(`Tlačidlo 'Registrácia na turnaj' bolo ${isVisible ? 'zobrazené' : 'skryté'}. Dôvod: ${reason}`);
    } else {
        console.warn("Element pre tlačidlo 'Registrácia na turnaj' nebol nájdený.");
    }
};

/**
 * Prepína viditeľnosť a text tlačidla "Prihlásenie"/"Moja zóna".
 * @param {boolean} isLoggedIn - true ak je používateľ prihlásený, inak false.
 */
const updateLoginButton = (isLoggedIn) => {
    const loginLink = document.getElementById('login-button-wrapper');
    const loginButton = document.getElementById('login-button');

    if (loginLink && loginButton) {
        // Skryjeme tlačidlo na začiatku, aby sa predišlo blikaniu
        loginLink.style.display = 'none';
        
        if (isLoggedIn) {
            // Používateľ je prihlásený, zobrazíme "Moja zóna"
            loginLink.href = 'logged-in-my-data.html';
            loginButton.textContent = 'Moja zóna';

            // Získame rolu používateľa z globálnych dát
            const userRole = window.globalUserProfileData ? window.globalUserProfileData.role : null;
            const roleColor = getRoleColor(userRole);
            
            // Odstránime pôvodné triedy a nastavíme novú farbu pomocou inline štýlu
            loginButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = roleColor;
            loginButton.style.borderColor = roleColor;
            console.log(`Používateľ je prihlásený ako ${userRole}. Tlačidlo 'Moja zóna' bolo nastavené s farbou ${roleColor}.`);
        } else {
            // Používateľ je odhlásený, zobrazíme "Prihlásenie"
            loginLink.href = 'login.html';
            loginButton.textContent = 'Prihlásenie';
            // Vrátime pôvodné Tailwind triedy pre farbu
            loginButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
            loginButton.style.backgroundColor = ''; // Odstránime inline štýl
            console.log("Používateľ odhlásený. Tlačidlo 'Prihlásenie' bolo obnovené.");
        }
        
        // Zobrazíme tlačidlo až po nastavení všetkých vlastností
        loginLink.style.display = 'inline-block';
    } else {
        console.warn("Elementy pre tlačidlo prihlásenia neboli nájdené.");
    }
};

/**
 * Pomocná funkcia, ktorá vráti farbu na základe roly používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', atď.).
 * @returns {string} - Hex kód farby.
 */
const getRoleColor = (role) => {
    const defaultColor = '#4299E1'; // Modrá pre bežného používateľa

    switch (role) {
        case 'admin':
            return '#47b3ff'; // Tvoja farba pre admina
        case 'hall':
            return '#b06835'; // Tvoja farba pre halu
        case 'user':
            return '#9333EA'; // Tvoja farba pre bežného používateľa
        default:
            return defaultColor; // Predvolená farba, ak rola nie je definovaná
    }
};

/**
 * Zobrazí alebo skryje uvítaciu správu pre prihláseného používateľa.
 * @param {boolean} isLoggedIn - true pre zobrazenie, false pre skrytie.
 */
const toggleLoggedInMessage = (isLoggedIn) => {
    const loggedInMessage = document.getElementById('logged-in-message');
    if (loggedInMessage) {
        loggedInMessage.classList.toggle('hidden', !isLoggedIn);
        console.log(`Správa pre prihláseného používateľa bola ${isLoggedIn ? 'zobrazená' : 'skrytá'}.`);
    }
};

/**
 * Nastaví listener pre dáta o registrácii z Firestore.
 * Tieto dáta sa používajú na dynamické zobrazenie stavu registrácie na hlavnej stránke.
 */
const setupRegistrationDataListener = () => {
    try {
        if (!window.db) {
            console.error("Firestore databáza nie je inicializovaná. Nemôžem načítavať dáta.");
            return;
        }

        // Vytvorenie referencie na dokument
        const registrationDocRef = doc(window.db, "settings", "registration");

        // Počúvanie zmien v dokumente v reálnom čase
        onSnapshot(registrationDocRef, (docSnap) => {
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
                console.log("Dáta o registrácii boli aktualizované:", window.registrationDates);
                
                // Zobrazíme hlavičku, pretože už máme dáta o používateľovi a registrácii
                const mainHeader = document.getElementById('header-placeholder')?.querySelector('header');
                if (mainHeader) {
                    mainHeader.classList.remove('invisible');
                    console.log("Hlavička bola zobrazená po načítaní dát.");
                }
                const isLoggedIn = !!window.globalUserProfileData;

                // Ak je používateľ prihlásený, zobrazí sa mu len uvítacia správa a Moja zóna
                if (isLoggedIn) {
                    toggleLoggedInMessage(true);
                    toggleRegistrationButton(false);
                } else {
                    // Ak nie je prihlásený, zobrazíme mu stav registrácie
                    toggleLoggedInMessage(false);
                    updateRegistrationStatusText(window.registrationDates);
                }

                // Po nastavení celého UI aktualizujeme aj tlačidlo prihlásenia
                updateLoginButton(isLoggedIn);
            } else {
                console.log("Dokument 'settings/registration' nebol nájdený!");
                window.registrationDates = null;
                const isLoggedIn = !!window.globalUserProfileData;
                toggleRegistrationButton(false);
                updateLoginButton(isLoggedIn);
            }
        }, (error) => {
            console.error("Chyba pri počúvaní dát o registrácii:", error);
        });

        // Kontrola, či existujú kategórie (môže byť oddelená od registračných dátumov)
        const categoriesDocRef = doc(window.db, "settings", "categories");
        onSnapshot(categoriesDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const categories = docSnap.data();
                const hasCategories = Object.keys(categories).length > 0;
                console.log(`Dáta kategórií boli aktualizované. Počet kategórií: ${Object.keys(categories).length}`);
                
                // Ak nie sú kategórie, skryjeme tlačidlo na registráciu
                if (!hasCategories) {
                    toggleRegistrationButton(false, 'no-categories');
                }
            } else {
                console.warn("Dokument 'settings/categories' nebol nájdený!");
                toggleRegistrationButton(false, 'no-categories');
            }
        });

    } catch (error) {
        console.error("Chyba pri inicializácii listenerov Firestore:", error);
    }
};

// Počúvame na udalosť 'globalDataUpdated', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia a načítanie profilu sú dokončené.
window.addEventListener('globalDataUpdated', () => {
    console.log("Udalosť 'globalDataUpdated' bola prijatá.");
    // Spustíme listener pre registračné dáta, ktorý sa postará o celú logiku zobrazenia
    // registračného UI.
    setupRegistrationDataListener();
});
