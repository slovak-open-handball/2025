// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// a podmienene zobrazil tlačidlá a text na základe existencie kategórií a aktuálneho dátumu.
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
 * Pomocná funkcia na formátovanie objektu Timestamp do čitateľného reťazca "dňa dd. mm. yyyy o hh:mm hod".
 * Používa nezalomiteľné medzery (&nbsp;), aby sa zabránilo zalomeniu riadka v dátume.
 * @param {import('firebase/firestore').Timestamp} timestamp - Objekt Timestamp z Firestore.
 * @returns {string} Formátovaný dátum a čas.
 */
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `dňa ${day}.&nbsp;${month}.&nbsp;${year}&nbsp;o&nbsp;${hours}:${minutes}&nbsp;hod.`;
};

/**
 * Získa farbu na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user', 'null').
 * @returns {string} Hexadecimálny kód farby.
 */
const getRoleColor = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff'; // admin
        case 'hall':
            return '#b06835'; // hall
        case 'user':
            return '#9333EA'; // user
        default:
            return '#1d4ed8'; // null alebo iná rola
    }
};

/**
 * Nastaví onSnapshot listener na kategórie v Firestore a reaguje na ich zmeny.
 * Zobrazí/skryje tlačidlo na registráciu a zmení text na základe existencie kategórií
 * a platnosti dátumu registrácie.
 */
const setupCategoriesListener = () => {
    if (window.db) {
        const categoriesDocRef = doc(window.db, "settings", "categories");
        
        onSnapshot(categoriesDocRef, (docSnap) => {
            console.log("Dáta kategórií boli aktualizované!");
            // Spustíme logiku na zobrazenie/skrytie tlačidiel po načítaní dát kategórií
            updateRegistrationUI(docSnap);
        }, (error) => {
            console.error("Chyba pri načítaní údajov o kategóriách:", error);
            toggleRegistrationButton(false);
            updateRegistrationStatusText("Registrácia na turnaj nie je možná, neexistuje súťažná kategória.");
        });
    }
};

/**
 * Spustí odpočet do cieľového dátumu a aktualizuje text na stránke.
 * @param {Date} targetDate - Dátum, do ktorého sa má odpočítavať.
 */
const startCountdown = (targetDate) => {
    // Zrušíme predchádzajúci odpočet
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
    }

    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = targetDate.getTime() - now;
        const countdownElement = document.getElementById('countdown-timer');

        if (distance < 0) {
            clearInterval(countdownIntervalId);
            if (countdownElement) {
                countdownElement.innerHTML = '';
            }
            // Získame najnovšie dáta o kategóriách a aktualizujeme UI
            getDoc(doc(window.db, "settings", "categories")).then(updateRegistrationUI);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const countdownText = `
            <br>
            <span class="font-semibold text-lg">
                ${days} d ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}
            </span>
        `;
        
        if (countdownElement) {
            countdownElement.innerHTML = countdownText;
        }
    };

    updateCountdown();
    countdownIntervalId = setInterval(updateCountdown, 1000);
};

/**
 * Aktualizuje zobrazenie tlačidiel a textu na základe stavu registrácie a prihlásenia.
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap - Dokument s dátami o kategóriách.
 */
const updateRegistrationUI = (docSnap) => {
    // Zabezpečíme, že docSnap je platný objekt predtým, než k nemu pristupujeme.
    if (!docSnap) {
        console.warn("Chyba: Očakávaný objekt docSnap je null alebo undefined.");
        toggleRegistrationButton(false);
        return;
    }
    
    // Ak je používateľ prihlásený, skryjeme všetky registratúra texty a tlačidlá,
    // a zobrazíme len správu pre prihláseného používateľa.
    if (window.globalUserProfileData) {
        toggleRegistrationButton(false);
        updateRegistrationStatusText(''); // Vždy vymaže text o registrácii
        toggleLoggedInMessage(true);
        console.log("Používateľ je prihlásený, registračný text a tlačidlo sú skryté. Správa pre prihlásenie je zobrazená.");
        return;
    }

    // Ak používateľ nie je prihlásený, skryjeme správu o prihlásení a pokračujeme s logikou registrácie
    toggleLoggedInMessage(false);

    // Zrušíme existujúci časovač a interval, aby sme predišli duplicitným spusteniam
    if (timerId) {
        clearTimeout(timerId);
        timerId = null;
    }
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    const now = new Date();
    // Uistíme sa, že pracujeme s Timestamp objektmi priamo z Firestore
    const registrationStartDate = window.registrationDates?.registrationStartDate;
    const registrationEndDate = window.registrationDates?.registrationEndDate;
    
    const isRegistrationOpen = registrationStartDate && registrationEndDate &&
                               now >= registrationStartDate.toDate() &&
                               now < registrationEndDate.toDate();
    const isRegistrationBeforeStart = registrationStartDate && now < registrationStartDate.toDate();
    const isRegistrationEnded = registrationEndDate && now >= registrationEndDate.toDate();

    if (docSnap.exists() && Object.keys(docSnap.data()).length > 0) {
        console.log("Dáta kategórií:", docSnap.data());
        
        if (isRegistrationOpen) {
            toggleRegistrationButton(true);
            updateRegistrationStatusText(`
                <p>Registrácia na turnaj je spustená.</p>
                <p>Registrácia sa končí ${formatDate(registrationEndDate)}</p>
                <p class="text-sm text-gray-500" id="countdown-timer"></p>
            `);
            
            // Spustíme odpočet do konca registrácie
            startCountdown(registrationEndDate.toDate());
        } else if (isRegistrationBeforeStart) {
            toggleRegistrationButton(false);
            updateRegistrationStatusText(`
                <p>Registrácia na turnaj ešte nebola spustená.</p>
                <p>Registrácia sa spustí ${formatDate(registrationStartDate)}</p>
                <p class="text-sm text-gray-500" id="countdown-timer"></p>
            `);
            
            // Spustíme odpočet do začiatku registrácie
            startCountdown(registrationStartDate.toDate());
        } else if (isRegistrationEnded) {
            toggleRegistrationButton(false);
            updateRegistrationStatusText(`
                <p>Registrácia na turnaj je už ukončená.</p>
                <p>Registrácia bola ukončená ${formatDate(registrationEndDate)}</p>
            `);
        } else {
            toggleRegistrationButton(false);
            updateRegistrationStatusText(`<p>Registrácia na turnaj momentálne nie je otvorená.</p>`);
        }
    } else {
        console.log("Dokument s kategóriami nebol nájdený alebo je prázdny!");
        toggleRegistrationButton(false);
        updateRegistrationStatusText(`<p>Registrácia na turnaj nie je možná, neexistuje súťažná kategória.</p>`);
    }
};

/**
 * Nastaví onSnapshot listener pre dáta o registrácii.
 * Dátumy uloží do globálnej premennej a následne spustí listener pre kategórie.
 */
const setupRegistrationDataListener = () => {
    if (window.db) {
        const docRef = doc(window.db, "settings", "registration");
        onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                window.registrationDates = docSnap.data();
                console.log("Údaje o registrácii načítané a aktualizované:", window.registrationDates);
            } else {
                console.log("Dokument o registrácii nebol nájdený!");
                window.registrationDates = null;
            }
            // Po načítaní dát o registrácii spustíme listener pre kategórie,
            // aby sa prehodnotila viditeľnosť tlačidla.
            setupCategoriesListener();
        }, (error) => {
            console.error("Chyba pri načítaní údajov o registrácii:", error);
            window.registrationDates = null;
            setupCategoriesListener(); // Pokračujeme aj v prípade chyby, aby sme skryli tlačidlo.
        });
    } else {
        console.log("Firebase databáza nie je pripravená.");
    }
};

/**
 * Prepína viditeľnosť tlačidla na registráciu na turnaj.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleRegistrationButton = (isVisible) => {
    const registrationButtonWrapper = document.getElementById('tournament-registration-button-wrapper');
    if (registrationButtonWrapper) {
        registrationButtonWrapper.style.display = isVisible ? 'inline-block' : 'none';
        console.log(`Tlačidlo 'Registrácia na turnaj' bolo ${isVisible ? 'zobrazené' : 'skryté'}.`);
    }
};

/**
 * Prepína viditeľnosť textu o registrácii na domovskej stránke.
 * @param {string} [htmlContent=''] - HTML obsah na zobrazenie. Ak je prázdny, element sa skryje.
 */
const updateRegistrationStatusText = (htmlContent = '') => {
    const statusMessageElement = document.getElementById('registration-status-message');
    if (statusMessageElement) {
        if (htmlContent) {
            statusMessageElement.innerHTML = htmlContent;
            statusMessageElement.style.display = 'block';
            console.log(`Registračný text bol aktualizovaný a zobrazený.`);
        } else {
            statusMessageElement.innerHTML = '';
            statusMessageElement.style.display = 'none';
            console.log(`Registračný text bol skrytý.`);
        }
    }
};

/**
 * Prepína viditeľnosť správy pre prihláseného používateľa.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleLoggedInMessage = (isVisible) => {
    const messageElement = document.getElementById('logged-in-message');
    if (messageElement) {
        messageElement.style.display = isVisible ? 'block' : 'none';
        console.log(`Správa pre prihláseného používateľa bola ${isVisible ? 'zobrazená' : 'skrytá'}.`);
    }
};

/**
 * Aktualizuje text, odkaz a farbu tlačidla pre prihlásenie na základe stavu autentifikácie.
 * Ak je používateľ prihlásený, zobrazí "Moja zóna" a farbu zmení podľa jeho role.
 * @param {boolean} isLoggedIn - True, ak je používateľ prihlásený.
 */
const updateLoginButton = (isLoggedIn) => {
    const loginLink = document.getElementById('login-button-wrapper');
    const loginButton = loginLink ? loginLink.querySelector('button') : null;

    if (loginLink && loginButton) {
        // Na začiatku funkcie skryjeme tlačidlo, aby sa zabránilo blikaniu
        loginLink.style.display = 'none';

        if (isLoggedIn) {
            loginLink.href = 'logged-in-my-data.html';
            loginButton.textContent = 'Moja zóna';
            const role = window.globalUserProfileData?.role || 'null';
            const roleColor = getRoleColor(role);
            loginButton.style.backgroundColor = roleColor;
            // Odstránime Tailwind triedy pre farbu, aby sme predišli konfliktom
            loginButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            console.log(`Používateľ prihlásený s rolou '${role}'. Tlačidlo 'Moja zóna' bolo zmenené a zafarbené na ${roleColor}.`);
        } else {
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

// Predvolene skryjeme tlačidlá na začiatku, tento kód je pre istotu.
toggleRegistrationButton(false);
updateLoginButton(false);

// Počúvame na udalosť 'globalDataUpdated', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia a načítanie profilu sú dokončené.
window.addEventListener('globalDataUpdated', () => {
    console.log("Udalosť 'globalDataUpdated' bola prijatá.");
    const isLoggedIn = !!window.globalUserProfileData;
    updateLoginButton(isLoggedIn);
    // Spustíme listener pre registračné dáta, ktorý sa postará o celú logiku zobrazenia
    // registračného UI.
    setupRegistrationDataListener();
});

// Volanie funkcie aj pri prvom spustení pre prípad, že sa autentifikácia dokončí
// skôr, ako sa stihne pripojiť listener.
if (window.db) {
    const isLoggedIn = !!window.globalUserProfileData;
    updateLoginButton(isLoggedIn);
    setupRegistrationDataListener();
}
