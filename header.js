// header.js
// Tento súbor spravuje dynamické zobrazenie navigačných odkazov v hlavičke
// a obsluhuje akcie ako odhlásenie používateľa.
// Bol upravený tak, aby reagoval na zmeny v dátach registrácie a kategórií v reálnom čase,
// a zároveň aby pravidelne kontroloval aktuálny čas, aby sa odkaz zobrazil alebo skryl
// presne v momente, keď sa prekročí dátum otvorenia alebo uzavretia registrácie.
// Nová funkcionalita: Pridáva listener pre zobrazovanie notifikácií z databázy pre administrátorov.
// Úpravy: Zlepšenie formátovania notifikácií a zabezpečenie, aby sa nové notifikácie zobrazovali pod staršími.
// Fix: Zabezpečenie viditeľnosti hlavičky pri prvom načítaní stránky.
// Nová úprava: Pridáva funkciu na formátovanie telefónnych čísiel v notifikáciách pre lepšiu čitateľnosť.

// Importy pre potrebné Firebase funkcie
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// Import zoznamu predvolieb
import { countryDialCodes } from "./countryDialCodes.js";

// Globálna premenná na uloženie ID intervalu, aby sme ho mohli neskôr zrušiť
let registrationCheckIntervalId = null;
let unsubscribeFromNotifications = null; // Nová globálna premenná pre listener notifikácií
// Nové premenné na sledovanie stavu načítania dát
window.isRegistrationDataLoaded = false;
window.isCategoriesDataLoaded = false;
let isFirestoreListenersSetup = false; // Nový flag pre sledovanie, či sú listenery Firestore nastavené
// NOVINKA: Pridaná globálna premenná na indikáciu, že kategórie sú načítané
window.areCategoriesLoaded = false;

// Premenná na sledovanie predchádzajúceho počtu neprečítaných notifikácií pre inteligentné prekresľovanie
let previousNotificationCount = -1; 


// Globálna funkcia pre zobrazenie notifikácií
// Vytvorí a spravuje modálne okno pre správy o úspechu alebo chybách
window.showGlobalNotification = (message, type = 'success') => {
    let notificationElement = document.getElementById('global-notification');
    
    // Ak element ešte neexistuje, vytvoríme ho a pridáme do tela dokumentu
    if (!notificationElement) {
        notificationElement = document.createElement('div');
        notificationElement.id = 'global-notification';
        // Používame Tailwind CSS triedy pre štýlovanie a pozicovanie
        notificationElement.className = `
            fixed top-4 left-1/2 transform -translate-x-1/2 z-[100]
            p-4 rounded-lg shadow-lg text-white font-semibold transition-all duration-300 ease-in-out
            flex items-center space-x-2
            opacity-0 pointer-events-none
        `;
        document.body.appendChild(notificationElement);
    }

    // Nastavíme obsah a farbu na základe typu notifikácie
    // Pre úspech použijeme farbu #3A8D41, pre chybu červenú
    const bgColor = type === 'success' ? 'bg-[#3A8D41]' : 'bg-red-600';
    notificationElement.className = notificationElement.className.replace(/bg-[\w-]+/, bgColor);
    notificationElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${type === 'success' 
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'}
        </svg>
        <span>${message}</span>
    `;

    // Zobrazenie notifikácie
    setTimeout(() => {
        notificationElement.classList.add('opacity-100', 'pointer-events-auto');
    }, 10);

    // Skrytie notifikácie po 5 sekundách
    setTimeout(() => {
        notificationElement.classList.remove('opacity-100', 'pointer-events-auto');
    }, 7500);
};

/**
 * NOVÁ FUNKCIA: Formátuje telefónne číslo na základe predvolieb.
 * @param {string} phoneNumber - Neformátované telefónne číslo.
 * @returns {string} Naformátované telefónne číslo.
 */
const formatPhoneNumber = (phoneNumber) => {
    // Odstránime všetky nečíslicové znaky, okrem '+' na začiatku
    const cleaned = phoneNumber.replace(/[^+\d]/g, '');
    let number = cleaned;

    // Nájdeme predvoľbu
    // Zoznam predvolieb je zoradený zostupne podľa dĺžky, aby sa našla najpresnejšia zhoda
    const sortedDialCodes = countryDialCodes.sort((a, b) => b.dialCode.length - a.dialCode.length);
    let dialCode = '';

    for (const code of sortedDialCodes) {
        if (number.startsWith(code.dialCode)) {
            dialCode = code.dialCode;
            number = number.substring(dialCode.length);
            break;
        }
    }

    // Ak sa nenašla žiadna predvoľba, vrátime pôvodné číslo
    if (!dialCode) {
        return phoneNumber;
    }

    // Odstránime medzery, ktoré tam mohli zostať
    number = number.replace(/\s/g, '');

    // Rozdelíme zvyšok čísla do skupín po troch čísliciach
    let formattedNumber = '';
    while (number.length > 0) {
        formattedNumber += number.substring(0, 3);
        number = number.substring(3);
        if (number.length > 0) {
            formattedNumber += ' ';
        }
    }

    return `${dialCode} ${formattedNumber}`.trim();
};

/**
 * Nová funkcia na formátovanie reťazca notifikácie s bold a italic textom.
 * Hľadá štyri apostrofy a formátuje text medzi nimi.
 * @param {string} text - Pôvodný reťazec.
 * @returns {string} Naformátovaný reťazec.
 */
const formatNotificationMessage = (text) => {
    // Nájdeme indexy apostrofov
    const firstApostrophe = text.indexOf("'");
    const secondApostrophe = text.indexOf("'", firstApostrophe + 1);
    const thirdApostrophe = text.indexOf("'", secondApostrophe + 1);
    const fourthApostrophe = text.indexOf("'", thirdApostrophe + 1);

    // Ak nájdeme všetky štyri apostrofy, naformátujeme text
    if (firstApostrophe !== -1 && secondApostrophe !== -1 && thirdApostrophe !== -1 && fourthApostrophe !== -1) {
        let oldText = text.substring(firstApostrophe + 1, secondApostrophe);
        let newText = text.substring(thirdApostrophe + 1, fourthApostrophe);

        // Skontrolujeme, či ide o telefónne číslo a naformátujeme ho
        if (oldText.startsWith('+') && newText.startsWith('+')) {
            oldText = formatPhoneNumber(oldText);
            newText = formatPhoneNumber(newText);
        }

        // Nahradíme pôvodné časti novými s HTML tagmi
        let formattedText = text.substring(0, firstApostrophe);
        formattedText += `<em>${oldText}</em>`;
        formattedText += text.substring(secondApostrophe + 1, thirdApostrophe);
        formattedText += `<strong>${newText}</strong>`;
        formattedText += text.substring(fourthApostrophe + 1);
        
        return formattedText;
    }
    
    // Ak sa formát nezhoduje, vrátime pôvodný text
    return text;
};

/**
 * Nová funkcia na zobrazenie notifikácie z databázy v pravom hornom rohu.
 * Vytvorí a spravuje dočasný element, ktorý sa objaví a po čase zmizne.
 * @param {string} message - Správa notifikácie.
 * @param {string} type - Typ notifikácie ('success', 'error', 'info').
 * @param {object} options - Voliteľné parametre pre sledovanie (summaryCount, notificationId).
 */
const showDatabaseNotification = (message, type = 'info', options = {}) => {
    let notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.className = `
            fixed top-4 right-4 z-[100]
            flex flex-col space-y-2
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Použijeme unikátne ID pre každú notifikáciu (alebo generické pre súhrn)
    const notificationId = options.notificationId ? `db-notification-${options.notificationId}` : `db-summary-notification`;
    
    // Ak už notifikácia s týmto ID existuje, odstránime ju predtým, ako vytvoríme novú
    const existingEl = document.getElementById(notificationId);
    if (existingEl) {
        existingEl.remove();
    }

    const notificationElement = document.createElement('div');
    
    notificationElement.id = notificationId;
    notificationElement.className = `
        bg-gray-800 text-white p-4 pr-10 rounded-lg shadow-lg
        transform translate-x-full transition-all duration-500 ease-out
        flex items-center space-x-2
    `;

    // Pridáme data- atribúty pre sledovanie typu notifikácie a počtu pre súhrn
    if (options.summaryCount !== undefined) {
        notificationElement.dataset.summaryCount = options.summaryCount;
    }
    if (options.notificationId) {
        notificationElement.dataset.notificationId = options.notificationId;
    }

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '�';
    
    const formattedMessage = message.replace(/\n/g, '<br>');

    notificationElement.innerHTML = `
        <span>${icon}</span>
        <span>${formattedMessage}</span>
        <button onclick="document.getElementById('${notificationId}').remove()" class="absolute top-1 right-1 text-gray-400 hover:text-white">&times;</button>
    `;

    // Pripojíme novú notifikáciu do kontajnera
    notificationContainer.appendChild(notificationElement);

    // Animácia vstupu notifikácie
    setTimeout(() => {
        notificationElement.classList.remove('translate-x-full');
    }, 10);

    // Animácia zmiznutia po 7 sekundách (iba pre individuálne správy)
    // Súhrnné notifikácie sa samé nezavrú, pokiaľ sa nezmení ich stav (napr. počet neprečítaných správ klesne pod 3)
    if (options.notificationId) { // Ak je to individuálna notifikácia (má notificationId)
        setTimeout(() => {
            notificationElement.classList.add('translate-x-full');
            setTimeout(() => notificationElement.remove(), 500);
        }, 7000);
    }
};

/**
 * Funkcia na odhlásenie používateľa
 */
const handleLogout = async () => {
    try {
        const auth = getAuth();
        await signOut(auth);
        console.log("header.js: Používateľ bol úspešne odhlásený.");
        window.showGlobalNotification('Úspešne ste sa odhlásili.', 'success');
        if (unsubscribeFromNotifications) {
            unsubscribeFromNotifications();
            unsubscribeFromNotifications = null;
            console.log("header.js: Listener notifikácií zrušený.");
        }
        window.location.href = 'login.html';
    } catch (error) {
        console.error("header.js: Chyba pri odhlásení:", error);
        window.showGlobalNotification('Chyba pri odhlásení. Skúste to znova.', 'error');
    }
};

/**
 * Funkcia, ktorá vráti farbu hlavičky na základe role používateľa.
 * @param {string} role - Rola používateľa ('admin', 'hall', 'user').
 * @returns {string} Hex kód farby.
 */
const getHeaderColorByRole = (role) => {
    switch (role) {
        case 'admin':
            return '#47b3ff';
        case 'hall':
            return '#b06835';
        case 'user':
            return '#9333EA';
        default:
            return '#1D4ED8';
    }
}

/**
 * Funkcia na aktualizáciu viditeľnosti odkazov a farby hlavičky na základe stavu autentifikácie.
 * Táto funkcia tiež kontroluje, či sú načítané všetky potrebné dáta, a až potom zruší triedu "invisible".
 * @param {object} userProfileData - Dáta profilu používateľa.
 */
const updateHeaderLinks = (userProfileData) => {
    const authLink = document.getElementById('auth-link');
    const profileLink = document.getElementById('profile-link');
    const logoutButton = document.getElementById('logout-button');
    const headerElement = document.querySelector('header');
    
    if (!authLink || !profileLink || !logoutButton || !headerElement) {
        console.error("header.js: Niektoré elementy hlavičky neboli nájdené.");
        return;
    }

    // NOVÁ PODMIENKA: Ak je stránka register.html, zachováme pôvodnú farbu hlavičky
    if (window.location.pathname.includes('register.html')) {
        headerElement.style.backgroundColor = '#1D4ED8'; // Nastavte pevnú farbu (napr. pôvodnú modrú)
        headerElement.classList.remove('invisible'); // Zabezpečiť, že hlavička je viditeľná
        // Zobrazenie/skrytie odkazov pre registračnú stránku
        authLink.classList.remove('hidden');
        profileLink.classList.add('hidden');
        logoutButton.classList.add('hidden');
        // Skryť odkaz "Registrácia na turnaj" na samotnej registračnej stránke, aby sa necyklovalo
        const registerLink = document.getElementById('register-link');
        if (registerLink) {
            registerLink.classList.add('hidden');
        }
        return; // Ukončíme funkciu, aby sa nepoužila dynamická farba a logika pre ostatné stránky
    }

    // Podmienka pre zobrazenie hlavičky pre ostatné stránky
    if (window.isGlobalAuthReady && window.isRegistrationDataLoaded && window.isCategoriesDataLoaded) {
        if (userProfileData) {
            authLink.classList.add('hidden');
            profileLink.classList.remove('hidden');
            logoutButton.classList.remove('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(userProfileData.role);

            if (userProfileData.role === 'admin' && userProfileData.displayNotifications) {
                if (!unsubscribeFromNotifications) {
                    setupNotificationListenerForAdmin();
                }
            } else {
                if (unsubscribeFromNotifications) {
                    unsubscribeFromNotifications();
                    unsubscribeFromNotifications = null;
                    console.log("header.js: Listener notifikácií zrušený, pretože používateľ nie je admin alebo ich nemá povolené.");
                }
            }
        } else {
            authLink.classList.remove('hidden');
            profileLink.classList.add('hidden');
            logoutButton.classList.add('hidden');
            headerElement.style.backgroundColor = getHeaderColorByRole(null);
            if (unsubscribeFromNotifications) {
                unsubscribeFromNotifications();
                unsubscribeFromNotifications = null;
                console.log("header.js: Listener notifikácií zrušený pri odhlásení.");
            }
        }

        updateRegistrationLinkVisibility(userProfileData);

        headerElement.classList.remove('invisible');
    }
};

/**
 * Funkcia na aktualizáciu viditeľnosti odkazu "Registrácia na turnaj" na základe
 * aktuálneho dátumu a existencie kategórií.
 * Odkaz sa zobrazí len vtedy, ak obe podmienky platia súčasne.
 * @param {object} userProfileData - Dáta profilu používateľa.
 */
const updateRegistrationLinkVisibility = (userProfileData) => {
    const registerLink = document.getElementById('register-link');
    if (!registerLink) return;

    // Ak je používateľ prihlásený (userProfileData existuje), skryjeme odkaz "Registrácia na turnaj"
    if (userProfileData) {
        registerLink.classList.add('hidden');
        return; // Ukončíme funkciu, aby sa neriešili ďalšie podmienky
    }

    const isRegistrationOpen = window.registrationDates && new Date() >= window.registrationDates.registrationStartDate.toDate() && new Date() <= window.registrationDates.registrationEndDate.toDate();
    const hasCategories = window.hasCategories;

    if (isRegistrationOpen && hasCategories) {
        registerLink.classList.remove('hidden');
        if (userProfileData) { // Táto podmienka je teraz redundantná, ale ponechávam pre istotu
            registerLink.href = 'logged-in-registration.html';
        } else {
            registerLink.href = 'register.html';
        }
    } else {
        registerLink.classList.add('hidden');
    }
};

/**
 * NOVÁ FUNKCIA: Nastaví listener pre notifikácie admina.
 * Počúva na zmeny v kolekcii /notifications a zobrazuje nové správy.
 */
const setupNotificationListenerForAdmin = () => {
    if (!window.db) {
        console.warn("header.js: Firestore databáza nie je inicializovaná pre notifikácie.");
        return;
    }

    if (unsubscribeFromNotifications) {
        unsubscribeFromNotifications();
    }
    
    const notificationsCollectionRef = collection(window.db, "notifications");
    
    unsubscribeFromNotifications = onSnapshot(notificationsCollectionRef, async (snapshot) => {
        const auth = getAuth();
        const userId = auth.currentUser ? auth.currentUser.uid : null;

        if (!userId) {
            console.log("header.js: Používateľ nie je prihlásený, notifikácie sa nebudú spracovávať.");
            const container = document.getElementById('notification-container');
            if (container) {
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
            }
            previousNotificationCount = -1; // Reset count
            return;
        }

        // Filtrujeme neprečítané notifikácie priamo zo snapshotu
        const unreadNotifications = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(notification => !(notification.seenBy || []).includes(userId));
        
        const currentUnreadCount = unreadNotifications.length;

        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) return; // Kontajner by mal byť vytvorený funkciou showDatabaseNotification

        // Určujeme, či je potrebné úplne prekresliť zobrazenie notifikácií
        // K tomu dôjde, ak počet neprečítaných správ prekročí prah (3), klesne na 0,
        // alebo ak sa zmení počet správ v režime súhrnu.
        const shouldRedrawAll = 
            (currentUnreadCount > 3 && previousNotificationCount <= 3) || // Prechod na súhrn
            (currentUnreadCount <= 3 && previousNotificationCount > 3) || // Prechod na individuálne
            (currentUnreadCount === 0 && previousNotificationCount > 0) || // Všetky vyčistené
            (currentUnreadCount > 3 && currentUnreadCount !== previousNotificationCount && previousNotificationCount > 3); // Zmena počtu v režime súhrnu


        // Vyčistíme existujúce notifikácie, ak je potrebné úplné prekreslenie
        if (shouldRedrawAll) {
            while (notificationContainer.firstChild) {
                notificationContainer.removeChild(notificationContainer.firstChild);
            }
        }

        if (currentUnreadCount > 3) {
            // Zobrazíme všeobecnú súhrnnú notifikáciu
            // Zobrazíme ju len ak je potrebné prekresliť všetko, alebo ak ešte žiadna nie je zobrazená
            // alebo ak sa zmenil počet v súhrne
            if (shouldRedrawAll || notificationContainer.children.length === 0 || notificationContainer.children[0].dataset.summaryCount !== String(currentUnreadCount)) {
                showDatabaseNotification(`Máte ${currentUnreadCount} nové neprečítané upozornenia.`, 'info', { summaryCount: currentUnreadCount });
            }
        } else if (currentUnreadCount > 0 && currentUnreadCount <= 3) {
            // Zobrazíme jednotlivé neprečítané notifikácie
            // Najskôr si vytvoríme zoznam ID aktuálne zobrazených notifikácií
            const currentlyVisibleIds = new Set(Array.from(notificationContainer.children)
                                                    .map(el => el.dataset.notificationId)
                                                    .filter(Boolean));

            for (const notification of unreadNotifications) {
                // Zobrazíme len tie, ktoré ešte nie sú zobrazené
                if (!currentlyVisibleIds.has(notification.id)) {
                    let changesMessage = '';
                    if (Array.isArray(notification.changes) && notification.changes.length > 0) {
                        const changeLabel = notification.changes.length > 1 ? " zmenil tieto údaje:" : "zmenil tento údaj:";
                        changesMessage = `Používateľ ${notification.userEmail} ${changeLabel}\n`;
                        const formattedChanges = notification.changes.map(changeString => formatNotificationMessage(changeString));
                        changesMessage += formattedChanges.join('<br>');
                    } else if (typeof notification.changes === 'string') {
                        changesMessage = `Používateľ ${notification.userEmail} zmenil tento údaj:\n${formatNotificationMessage(notification.changes)}`;
                    } else {
                        changesMessage = `Používateľ ${notification.userEmail} vykonal zmenu.`;
                    }
                    
                    showDatabaseNotification(changesMessage, notification.type || 'info', { notificationId: notification.id });
                    
                    // Označíme notifikáciu ako prečítanú hneď po jej zobrazení individuálne
                    const notificationDocRef = doc(window.db, "notifications", notification.id);
                    try {
                        await updateDoc(notificationDocRef, {
                            seenBy: arrayUnion(userId)
                        });
                    } catch (e) {
                        console.error("header.js: Chyba pri aktualizácii notifikácie 'seenBy':", e);
                    }
                }
            }
            // Odstránime z DOM všetky notifikácie, ktoré už nie sú neprečítané (napr. boli označené ako prečítané v 'Moja zóna')
            Array.from(notificationContainer.children).forEach(el => {
                const id = el.dataset.notificationId;
                if (id && !unreadNotifications.some(n => n.id === id)) {
                    el.remove();
                }
            });

        } else if (currentUnreadCount === 0) {
            // Ak nie sú žiadne neprečítané notifikácie, uistíme sa, že kontajner je prázdny
            if (notificationContainer) {
                while (notificationContainer.firstChild) {
                    notificationContainer.removeChild(notificationContainer.firstChild);
                }
            }
        }
        
        previousNotificationCount = currentUnreadCount; // Aktualizujeme pre ďalšie porovnanie

    }, (error) => {
        console.error("header.js: Chyba pri počúvaní notifikácií:", error);
    });

    console.log("header.js: Listener pre notifikácie admina nastavený.");
};


/**
 * Hlavná funkcia na načítanie hlavičky a pripojenie skriptov.
 * Načítava header.html a vkladá ho do placeholderu.
 */
window.loadHeaderAndScripts = async () => {
    try {
        const headerPlaceholder = document.getElementById('header-placeholder');
        const response = await fetch('header.html');
        
        if (!response.ok) throw new Error('Chyba pri načítaní header.html');
        const headerHtml = await response.text();
        
        if (headerPlaceholder) {
            headerPlaceholder.innerHTML = headerHtml;
        }

        // Po načítaní hlavičky pridáme event listener na tlačidlo odhlásenia
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
            console.log("header.js: Listener pre tlačidlo odhlásenia bol pridaný.");
        }

        // Pridáme listener na udalosť, ktorú posiela 'authentication.js'
        window.addEventListener('globalDataUpdated', (event) => {
            console.log('header.js: Prijatá udalosť "globalDataUpdated". Aktualizujem hlavičku.');
            window.isGlobalAuthReady = true; 
            setupFirestoreListeners();
            updateHeaderLinks(event.detail);
        });

        // Ak už je autentifikácia pripravená pri načítaní tohto skriptu, spustíme listenery manuálne.
        if (window.isGlobalAuthReady) {
             console.log('header.js: Autentifikačné dáta sú už načítané, spúšťam listenery Firestore.');
             setupFirestoreListeners();
             updateHeaderLinks(window.globalUserProfileData);
        }

    } catch (error) {
        console.error("header.js: Chyba pri inicializácii hlavičky:", error);
    }
};

// Spustenie načítania hlavičky, ak DOM už bol načítaný
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', window.loadHeaderAndScripts);
} else {
    window.loadHeaderAndScripts();
}
