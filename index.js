// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// a podmienene zobrazil tlačidlá a text na základe existencie kategórií a aktuálneho dátumu.

import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Globálna premenná na uloženie dát o registrácii
window.registrationDates = null;

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
            // V oboch prípadoch text zobrazíme
            toggleMainText(true);

            // Získame aktuálny dátum
            const now = new Date();
            const isRegistrationOpen = window.registrationDates &&
                                       now >= window.registrationDates.registrationStartDate.toDate() &&
                                       now <= window.registrationDates.registrationEndDate.toDate();

            if (docSnap.exists() && Object.keys(docSnap.data()).length > 0) {
                console.log("Dáta kategórií:", docSnap.data());
                
                if (isRegistrationOpen) {
                    toggleRegistrationButton(true);
                    updateMainText("Pre pokračovanie sa, prosím, prihláste alebo sa zaregistrujte.");
                } else {
                    toggleRegistrationButton(false);
                    updateMainText("Registrácia na turnaj momentálne nie je otvorená.");
                }
            } else {
                console.log("Dokument s kategóriami nebol nájdený alebo je prázdny!");
                toggleRegistrationButton(false);
                updateMainText("Registrácia na turnaj nie je možná, neexistuje súťažná kategória.");
            }
        }, (error) => {
            console.error("Chyba pri načítaní údajov o kategóriách:", error);
            toggleRegistrationButton(false);
            updateMainText("Registrácia na turnaj nie je možná, neexistuje súťažná kategória.");
        });
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
 * Prepína viditeľnosť tlačidla na prihlásenie.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleLoginButton = (isVisible) => {
    const loginButtonWrapper = document.getElementById('login-button-wrapper');
    if (loginButtonWrapper) {
        loginButtonWrapper.style.display = isVisible ? 'block' : 'none';
        console.log(`Tlačidlo 'Prihlásenie' bolo ${isVisible ? 'zobrazené' : 'skryté'}.`);
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
    // Po prijatí udalosti zobrazíme tlačidlo na prihlásenie a začneme načítavať dáta o registrácii.
    // Text a tlačidlo pre registráciu sa budú ovládať až po načítaní dát.
    toggleLoginButton(true);
    setupRegistrationDataListener();
});

// Volanie funkcií aj pri prvom spustení pre prípad, že sa autentifikácia dokončí
// skôr, ako sa stihne pripojiť listener.
if (window.db) {
    toggleLoginButton(true);
    setupRegistrationDataListener();
}
