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
let lastRegistrationStatus = null; // Uloží posledný stav registrácie

/**
 * Pomocná funkcia na formátovanie objektu Timestamp do čitateľného reťazca "dňa dd. mm. yyyy o hh:mm hod.".
 * Používa nezalomiteľné medzery (&nbsp;), aby sa zabránilo zalomeniu riadka v dátume.
 * @param {import('firebase/firestore').Timestamp} timestamp - Objekt Timestamp z Firestore.
 * @returns {string} Formátovaný dátum a čas.
 */
const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) {
        return 'Neznámy dátum';
    }
    const date = timestamp.toDate();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const formatted = date.toLocaleDateString('sk-SK', options).replace(/\s/g, '&nbsp;');
    return `dňa&nbsp;${formatted.replace(',', '&nbsp;o&nbsp;')}&nbsp;hod.`;
};

/**
 * Formátuje zostávajúci čas do reťazca.
 * @param {number} totalSeconds - Celkový počet sekúnd.
 * @returns {string} Formátovaný reťazec (napr. "2 dni, 10:30:15").
 */
const formatCountdown = (totalSeconds) => {
    if (totalSeconds < 0) return '00:00:00';
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days} deň${days > 1 ? 'e' : ''}`);
    parts.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    return parts.join(', ');
};

/**
 * Aktualizuje odpočet registrácie na hlavnej stránke.
 * @param {import('firebase/firestore').Timestamp} endTime - Čas ukončenia odpočtu.
 * @param {HTMLElement} countdownElement - Element, do ktorého sa má písať odpočet.
 * @param {HTMLElement} statusMessageElement - Element, ktorý zobrazuje status registrácie.
 */
const updateCountdown = (endTime, countdownElement, statusMessageElement) => {
    if (!endTime || !endTime.toDate) return;
    const endTimestamp = endTime.toDate().getTime();

    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
    }

    countdownIntervalId = setInterval(() => {
        const now = new Date().getTime();
        const distance = endTimestamp - now;

        if (distance < 0) {
            clearInterval(countdownIntervalId);
            countdownElement.textContent = '00:00:00';
            statusMessageElement.innerHTML = `
                <p class="text-red-600 text-xl font-bold">Registrácia bola ukončená dňa ${formatDate(endTime)}.</p>
                <p class="text-red-600 text-lg">Ďakujeme za váš záujem.</p>
            `;
            toggleRegistrationButton(false);
            console.log("Odpočet ukončený. Registrácia uzavretá.");
            return;
        }

        const totalSeconds = Math.floor(distance / 1000);
        countdownElement.textContent = formatCountdown(totalSeconds);
    }, 1000);
};

/**
 * Skontroluje stav registrácie a aktualizuje UI.
 * @param {object} registrationDates - Dátumové objekty registrácie.
 * @param {boolean} categoriesExist - Indikuje, či existujú kategórie.
 */
const checkRegistrationStatus = (registrationDates, categoriesExist) => {
    console.log("checkRegistrationStatus spustená.");
    const now = new Date().getTime();
    const registrationStatusElement = document.getElementById('registration-status-message');
    const countdownElement = document.getElementById('registration-countdown');
    const isRegistrationOpen = now >= registrationDates.start.toDate().getTime() && now < registrationDates.end.toDate().getTime();
    const isRegistrationUpcoming = now < registrationDates.start.toDate().getTime();
    const isRegistrationClosed = now >= registrationDates.end.toDate().getTime();

    if (!registrationStatusElement || !countdownElement) {
        console.warn("Elementy pre status registrácie neboli nájdené.");
        return;
    }

    // Uložíme posledný stav
    const currentStatus = { isRegistrationOpen, isRegistrationUpcoming, isRegistrationClosed };
    if (JSON.stringify(currentStatus) === JSON.stringify(lastRegistrationStatus)) {
        // Ak sa stav nezmenil, nerobíme nič
        return;
    }
    lastRegistrationStatus = currentStatus;

    if (!categoriesExist) {
        registrationStatusElement.innerHTML = `
            <p class="text-gray-600 text-xl font-bold">Kategórie pre turnaj ešte neboli zverejnené.</p>
            <p class="text-gray-600 text-lg">Prosím, skontrolujte stránku neskôr.</p>
        `;
        toggleRegistrationButton(false);
        console.log("Kategórie neexistujú. Registrácia skrytá.");
        return;
    }

    if (isRegistrationOpen) {
        registrationStatusElement.innerHTML = `
            <p class="text-green-600 text-xl font-bold">Registrácia je momentálne OTVORENÁ!</p>
            <p class="text-green-600 text-lg">Ukončenie registrácie: ${formatDate(registrationDates.end)}</p>
            <p class="text-green-600 text-lg">Zostáva do konca: <span id="registration-countdown"></span></p>
        `;
        const countdownSpan = document.getElementById('registration-countdown');
        if (countdownSpan) {
             updateCountdown(registrationDates.end, countdownSpan, registrationStatusElement);
        }
        toggleRegistrationButton(true);
        console.log("Registrácia otvorená. Zobrazujem odpočet a tlačidlo.");
    } else if (isRegistrationUpcoming) {
        registrationStatusElement.innerHTML = `
            <p class="text-blue-600 text-xl font-bold">Registrácia sa spustí čoskoro!</p>
            <p class="text-blue-600 text-lg">Dátum spustenia registrácie: ${formatDate(registrationDates.start)}</p>
            <p class="text-blue-600 text-lg">Zostáva do spustenia: <span id="registration-countdown"></span></p>
        `;
        const countdownSpan = document.getElementById('registration-countdown');
        if (countdownSpan) {
            updateCountdown(registrationDates.start, countdownSpan, registrationStatusElement);
        }
        toggleRegistrationButton(false);
        console.log("Registrácia sa ešte nezačala. Skrývam tlačidlo.");
    } else if (isRegistrationClosed) {
        registrationStatusElement.innerHTML = `
            <p class="text-red-600 text-xl font-bold">Registrácia bola ukončená dňa ${formatDate(registrationDates.end)}.</p>
            <p class="text-red-600 text-lg">Ďakujeme za váš záujem.</p>
        `;
        toggleRegistrationButton(false);
        console.log("Registrácia uzavretá. Skrývam tlačidlo.");
    } else {
        registrationStatusElement.innerHTML = `
            <p class="text-gray-600 text-xl font-bold">Stav registrácie nie je momentálne známy.</p>
        `;
        toggleRegistrationButton(false);
    }
};

/**
 * Nastaví onSnapshot listener na registračné dáta a kategórie.
 * Tým sa zabezpečí, že UI sa aktualizuje v reálnom čase, keď sa dáta zmenia.
 */
const setupRegistrationDataListener = async () => {
    // Ak sa dáta už načítavajú, zabránime opätovnému spusteniu listenera
    if (window.db && window.auth && window.isGlobalAuthReady) {
        console.log("setupRegistrationDataListener: Nastavujem listener pre dáta registrácie.");
        const registrationDocRef = doc(window.db, "global", "registration");

        // Použijeme Promise.all pre paralelné načítanie
        const registrationDataPromise = new Promise((resolve, reject) => {
            const unsubscribeRegistration = onSnapshot(registrationDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    window.registrationDates = docSnap.data();
                    console.log("Dáta registrácie načítané: ", window.registrationDates);
                    resolve(window.registrationDates);
                } else {
                    console.log("Dokument 'registration' nebol nájdený.");
                    resolve(null);
                }
            }, (error) => {
                console.error("Chyba pri načítaní dokumentu 'registration':", error);
                reject(error);
            });
            // Uložíme unsubscribe funkciu, aby sme ju mohli zavolať pri cleanup
            window.addEventListener('beforeunload', unsubscribeRegistration);
        });

        // Kontrola, či existujú aspoň nejaké kategórie
        const categoriesExistPromise = getDoc(doc(window.db, "global", "categories")).then(docSnap => {
            const exists = docSnap.exists() && docSnap.data().categories && docSnap.data().categories.length > 0;
            console.log("Kategórie existujú: ", exists);
            return exists;
        }).catch(error => {
            console.error("Chyba pri načítaní kategórií:", error);
            return false;
        });

        try {
            const [registrationDates, categoriesExist] = await Promise.all([registrationDataPromise, categoriesExistPromise]);
            if (registrationDates) {
                 checkRegistrationStatus(registrationDates, categoriesExist);
            } else {
                console.log("Chýbajú dáta o registrácii, zobrazujem predvolenú správu.");
                const registrationStatusElement = document.getElementById('registration-status-message');
                if (registrationStatusElement) {
                     registrationStatusElement.innerHTML = `
                        <p class="text-gray-600 text-xl font-bold">Stav registrácie nie je momentálne známy.</p>
                    `;
                }
                toggleRegistrationButton(false);
            }
        } catch (error) {
            console.error("Chyba pri načítaní dát registrácie alebo kategórií:", error);
        }
    } else {
        // Ak ešte nie je k dispozícii Firebase, počkáme a skúsime znova
        timerId = setTimeout(setupRegistrationDataListener, 500);
    }
};

/**
 * Zobrazí/skryje tlačidlo pre registráciu na turnaj.
 * @param {boolean} show - True pre zobrazenie, false pre skrytie.
 */
const toggleRegistrationButton = (show) => {
    const regButtonWrapper = document.getElementById('tournament-registration-button-wrapper');
    if (regButtonWrapper) {
        regButtonWrapper.style.display = show ? 'inline-block' : 'none';
        console.log(`Tlačidlo 'Registrácia na turnaj' je teraz ${show ? 'viditeľné' : 'skryté'}.`);
    } else {
        console.warn("Wrapper pre tlačidlo registrácie nebol nájdený.");
    }
};

/**
 * Aktualizuje text a odkaz tlačidla prihlásenia/môjho profilu.
 * @param {boolean} isLoggedIn - True, ak je používateľ prihlásený.
 * @param {object} userProfileData - Dáta profilu používateľa (voliteľné).
 */
const updateLoginButton = (isLoggedIn, userProfileData) => {
    const loginLink = document.getElementById('login-link-wrapper');
    const loginButton = document.getElementById('login-button');

    if (loginLink && loginButton) {
        if (isLoggedIn && userProfileData) {
            loginLink.href = 'logged-in-my-data.html';
            loginButton.textContent = 'Moja zóna';
            loginButton.classList.remove('bg-blue-500', 'hover:bg-blue-600'); // Odstránime pôvodné farby
            
            // Nastavíme farbu podľa roly používateľa
            const role = userProfileData.role;
            let buttonColorClass = 'bg-purple-600 hover:bg-purple-700'; // Predvolená farba (používateľ)
            if (role === 'admin') {
                buttonColorClass = 'bg-blue-500 hover:bg-blue-600';
            } else if (role === 'hall') {
                buttonColorClass = 'bg-yellow-500 hover:bg-yellow-600';
            }
            loginButton.classList.add(...buttonColorClass.split(' '));
            console.log(`Používateľ prihlásený ako '${role}'. Tlačidlo 'Moja zóna' bolo aktualizované.`);
        } else {
            loginLink.href = 'login.html';
            loginButton.textContent = 'Prihlásenie';
            loginButton.classList.remove('bg-purple-600', 'hover:bg-purple-700', 'bg-blue-500', 'hover:bg-blue-600', 'bg-yellow-500', 'hover:bg-yellow-600');
            // Vrátime pôvodné Tailwind triedy pre farbu
            loginButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
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
    updateLoginButton(isLoggedIn, window.globalUserProfileData);
    // Spustíme listener pre registračné dáta, ktorý sa postará o celú logiku zobrazenia
    // registračného UI.
    setupRegistrationDataListener();
});
