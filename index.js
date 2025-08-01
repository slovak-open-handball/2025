// index.js
// Tento súbor bol upravený tak, aby správne zobrazoval správu pre prihláseného používateľa
// pod hlavným nadpisom, ktorý zostáva nezmenený.
// Logika sa teraz stará o prepínanie medzi správou pre prihláseného používateľa a
// informáciami o stave registrácie pre odhlásených používateľov.

import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Aktualizuje zobrazenie tlačidiel a textu na základe stavu autentifikácie a dát registrácie.
 * @param {import('firebase/firestore').DocumentSnapshot} docSnap - Dokument s dátami o registrácii.
 */
const updateRegistrationUI = (docSnap) => {
    const registrationButtonWrapper = document.getElementById('tournament-registration-button-wrapper');
    const statusMessageElement = document.getElementById('registration-status-message');
    const loggedInMessageElement = document.getElementById('logged-in-message');

    // Ak je používateľ prihlásený, skryjeme text o registrácii a zobrazíme správu pre prihláseného používateľa.
    if (window.globalUserProfileData) {
        if (registrationButtonWrapper) registrationButtonWrapper.style.display = 'none';
        if (statusMessageElement) statusMessageElement.style.display = 'none';
        if (loggedInMessageElement) loggedInMessageElement.style.display = 'block';
        return;
    }

    // Ak používateľ nie je prihlásený, skryjeme správu o prihlásení a zobrazíme informácie o registrácii.
    if (loggedInMessageElement) loggedInMessageElement.style.display = 'none';

    // Ak existuje dokument s dátami o registrácii
    if (docSnap.exists()) {
        const data = docSnap.data();
        const now = new Date();
        const registrationStartDate = data.registrationStartDate.toDate();
        const registrationEndDate = data.registrationEndDate.toDate();

        if (now >= registrationStartDate && now < registrationEndDate) {
            // Registrácia prebieha, zobrazíme tlačidlo a správu
            if (registrationButtonWrapper) registrationButtonWrapper.style.display = 'inline-block';
            if (statusMessageElement) {
                statusMessageElement.innerHTML = `Registrácia na turnaj je spustená. Registrácia sa končí ${registrationEndDate.toLocaleString('sk-SK')}.`;
                statusMessageElement.style.display = 'block';
            }
        } else if (now < registrationStartDate) {
            // Registrácia ešte nebola spustená, skryjeme tlačidlo a zobrazíme správu
            if (registrationButtonWrapper) registrationButtonWrapper.style.display = 'none';
            if (statusMessageElement) {
                statusMessageElement.innerHTML = `Registrácia na turnaj ešte nebola spustená. Spustí sa ${registrationStartDate.toLocaleString('sk-SK')}.`;
                statusMessageElement.style.display = 'block';
            }
        } else {
            // Registrácia už skončila, skryjeme tlačidlo a zobrazíme správu
            if (registrationButtonWrapper) registrationButtonWrapper.style.display = 'none';
            if (statusMessageElement) {
                statusMessageElement.innerHTML = `Registrácia na turnaj je už ukončená.`;
                statusMessageElement.style.display = 'block';
            }
        }
    } else {
        // Dokument neexistuje, skryjeme tlačidlo a zobrazíme chybovú správu
        if (registrationButtonWrapper) registrationButtonWrapper.style.display = 'none';
        if (statusMessageElement) {
            statusMessageElement.innerHTML = `Registrácia na turnaj nie je možná.`;
            statusMessageElement.style.display = 'block';
        }
    }
};

/**
 * Aktualizuje text a odkaz tlačidla pre prihlásenie na základe stavu autentifikácie.
 * Ak je používateľ prihlásený, zobrazí "Moja zóna" a presmeruje na príslušnú stránku.
 * @param {boolean} isLoggedIn - True, ak je používateľ prihlásený.
 */
const updateLoginButton = (isLoggedIn) => {
    const loginLink = document.getElementById('login-button-wrapper');
    const loginButton = loginLink ? loginLink.querySelector('button') : null;

    if (loginLink && loginButton) {
        if (isLoggedIn) {
            loginLink.href = 'logged-in-my-data.html';
            loginButton.textContent = 'Moja zóna';
        } else {
            loginLink.href = 'login.html';
            loginButton.textContent = 'Prihlásenie';
        }
        loginLink.style.display = 'inline-block';
    }
};

// Počúvame na udalosť 'globalDataUpdated', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia a načítanie profilu sú dokončené.
window.addEventListener('globalDataUpdated', () => {
    console.log("Udalosť 'globalDataUpdated' bola prijatá.");
    const isLoggedIn = !!window.globalUserProfileData;
    updateLoginButton(isLoggedIn);
    // Nastavíme listener na zmeny v dokumente "registration"
    if (window.db && window.appId) {
        const docRef = doc(window.db, `artifacts/${window.appId}/settings/registration`);
        onSnapshot(docRef, updateRegistrationUI);
    }
});

// Počkáme, kým budú k dispozícii Firebase inštancie, a potom nastavíme listenery
if (window.db && window.appId) {
    const isLoggedIn = !!window.globalUserProfileData;
    updateLoginButton(isLoggedIn);
    const docRef = doc(window.db, `artifacts/${window.appId}/settings/registration`);
    onSnapshot(docRef, updateRegistrationUI);
}
