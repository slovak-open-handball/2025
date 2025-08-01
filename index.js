// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// a podmienene zobrazil tlačidlá a text na základe existencie kategórií.

import { getDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Načíta dátumové a časové údaje o registrácii z Firestore a vypíše ich do konzoly.
 */
const loadRegistrationData = async () => {
    // Skontrolujeme, či je inštancia Firestore databázy pripravená.
    if (window.db) {
        // Vytvorenie referencie na dokument v databáze.
        const docRef = doc(window.db, "settings", "registration");
        try {
            // Pokus o načítanie dokumentu.
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Ak dokument existuje, vypíšeme jeho dáta do konzoly.
                console.log("Údaje o registrácii:", docSnap.data());
            } else {
                // Ak dokument nebol nájdený, vypíšeme správu.
                console.log("Dokument o registrácii nebol nájdený!");
            }
        } catch (e) {
            // V prípade chyby pri načítaní vypíšeme detail chyby.
            console.error("Chyba pri načítaní údajov o registrácii:", e);
        }
    } else {
        console.log("Firebase databáza nie je pripravená.");
    }
};

/**
 * Nastaví onSnapshot listener na kategórie v Firestore a reaguje na ich zmeny.
 * Ak neexistujú žiadne kategórie, skryje tlačidlo na registráciu a zmení text.
 */
const setupCategoriesListener = () => {
    if (window.db) {
        // Vytvorenie referencie na dokument 'categories' pod kolekciou 'settings'.
        const categoriesDocRef = doc(window.db, "settings", "categories");
        
        // Nastavenie onSnapshot listenera.
        onSnapshot(categoriesDocRef, (docSnap) => {
            console.log("Dáta kategórií boli aktualizované!");
            // V oboch prípadoch - existencie alebo neexistencie kategórií - text zobrazíme.
            toggleMainText(true);
            if (docSnap.exists() && Object.keys(docSnap.data()).length > 0) {
                console.log("Dáta kategórií:", docSnap.data());
                
                // Ak dokument existuje a nie je prázdny, uistíme sa, že tlačidlo je viditeľné a nastavíme pôvodný text.
                toggleRegistrationButton(true);
                updateMainText("Pre pokračovanie sa, prosím, prihláste alebo sa zaregistrujte.");
            } else {
                // Ak dokument nebol nájdený alebo je prázdny, vypíšeme správu, skryjeme tlačidlo a zmeníme text.
                console.log("Dokument s kategóriami nebol nájdený alebo je prázdny!");
                toggleRegistrationButton(false);
                updateMainText("Registrácia na turnaj nie je možná, neexistuje súťažná kategória.");
            }
        }, (error) => {
            // V prípade chyby pri načítaní vypíšeme detail chyby, skryjeme tlačidlo a zmeníme text pre istotu.
            console.error("Chyba pri načítaní údajov o kategóriách:", error);
            toggleRegistrationButton(false);
            updateMainText("Registrácia na turnaj nie je možná, neexistuje súťažná kategória.");
        });
    }
};

/**
 * Prepína viditeľnosť tlačidla na prihlásenie.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleLoginButton = (isVisible) => {
    const loginButtonWrapper = document.getElementById('login-button-wrapper');
    if (loginButtonWrapper) {
        loginButtonWrapper.style.display = isVisible ? 'block' : 'none';
        console.log(`Tlačidlo 'Prihlásenie' bolo ${isVisible ? 'zobrazené' : 'skryté'}.`);
    } else {
        console.log("Wrapper pre tlačidlo 'Prihlásenie' nebol nájdený v DOM.");
    }
};

/**
 * Prepína viditeľnosť tlačidla na registráciu na turnaj.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleRegistrationButton = (isVisible) => {
    const registrationButtonWrapper = document.getElementById('tournament-registration-button-wrapper');
    if (registrationButtonWrapper) {
        registrationButtonWrapper.style.display = isVisible ? 'block' : 'none';
        console.log(`Tlačidlo 'Registrácia na turnaj' bolo ${isVisible ? 'zobrazené' : 'skryté'}.`);
    } else {
        console.log("Wrapper pre tlačidlo 'Registrácia na turnaj' nebol nájdený v DOM.");
    }
};

/**
 * Prepína viditeľnosť textu na domovskej stránke.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleMainText = (isVisible) => {
    const mainTextElement = document.getElementById('main-page-text');
    if (mainTextElement) {
        mainTextElement.style.display = isVisible ? 'block' : 'none';
        console.log(`Text na domovskej stránke bol ${isVisible ? 'zobrazený' : 'skrytý'}.`);
    } else {
        console.log("Element s textom na domovskej stránke nebol nájdený v DOM.");
    }
};

/**
 * Aktualizuje text na domovskej stránke.
 * @param {string} text - Nový text pre element.
 */
const updateMainText = (text) => {
    const mainTextElement = document.getElementById('main-page-text');
    if (mainTextElement) {
        mainTextElement.textContent = text;
        console.log(`Text na domovskej stránke bol zmenený na: "${text}"`);
    }
};

// Počúvame na udalosť 'globalDataUpdated', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia a načítanie profilu sú dokončené.
window.addEventListener('globalDataUpdated', () => {
    console.log("Udalosť 'globalDataUpdated' bola prijatá.");
    // Po prijatí udalosti zobrazíme tlačidlo na prihlásenie a text,
    // a následne načítame dáta o registrácii a nastavíme listener pre kategórie.
    toggleLoginButton(true);
    // Text zobrazíme až po načítaní dát
    // toggleMainText(true);
    loadRegistrationData();
    setupCategoriesListener();
});

// Volanie funkcií aj pri prvom spustení pre prípad, že sa autentifikácia dokončí
// skôr, ako sa stihne pripojiť listener.
if (window.db) {
    toggleLoginButton(true);
    // toggleMainText(true);
    loadRegistrationData();
    setupCategoriesListener();
}
