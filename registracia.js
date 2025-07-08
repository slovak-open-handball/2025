// Import potrebných Firebase modulov
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// Globálne premenné poskytované prostredím Canvas (MUSIA byť použité)
// __app_id: ID aktuálnej aplikácie
// __firebase_config: Firebase konfigurácia ako reťazec JSON
// __initial_auth_token: Firebase vlastný autentifikačný token
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Inicializácia Firebase aplikácie
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Referencia na kolekciu Firestore pre registrácie tímov
// Dáta sa uložia do /artifacts/{appId}/public/data/registracia-timov
const registrationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registracia-timov');

/**
 * Funkcia na zobrazenie správy pre používateľa (úspech/chyba).
 * @param {string} messageText Text správy.
 * @param {string} type Typ správy ('success' alebo 'error').
 */
function showMessage(messageText, type) {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.textContent = messageText;
        messageDiv.className = `message ${type}`; // Nastaví triedu pre štýlovanie
        messageDiv.classList.remove('hidden'); // Zobrazí správu
    }
}

/**
 * Funkcia na skrytie správy pre používateľa.
 */
function hideMessage() {
    const messageDiv = document.getElementById('message');
    if (messageDiv) {
        messageDiv.classList.add('hidden'); // Skryje správu
        messageDiv.textContent = ''; // Vymaže text
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const registrationForm = document.getElementById('registrationForm');
    const emailInput = document.getElementById('email');
    const teamInfoInput = document.getElementById('teamInfo');

    // Autentifikácia používateľa pri načítaní stránky
    try {
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Firebase: Úspešne prihlásený pomocou vlastného tokenu.");
        } else {
            await signInAnonymously(auth);
            console.log("Firebase: Úspešne prihlásený anonymne.");
        }
    } catch (error) {
        console.error("Firebase: Chyba pri prihlasovaní:", error);
        showMessage("Chyba pri pripojení k databáze. Skúste to znova.", "error");
    }

    // Pridanie poslucháča udalostí pre odoslanie formulára
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Zabráni predvolenému správaniu formulára (obnovenie stránky)
        hideMessage(); // Skryje predchádzajúce správy

        const email = emailInput.value.trim();
        const teamInfo = teamInfoInput.value.trim();

        // Jednoduchá validácia vstupov
        if (!email || !teamInfo) {
            showMessage("Prosím, vyplňte obe polia.", "error");
            return;
        }

        // Validácia e-mailovej adresy
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage("Prosím, zadajte platnú e-mailovú adresu.", "error");
            return;
        }

        try {
            // Dáta na uloženie do Firestore
            const registrationData = {
                email: email,
                teamInfo: teamInfo,
                timestamp: new Date() // Zaznamená čas odoslania
            };

            // Uloženie dát do Firestore
            const docRef = await addDoc(registraciaTimovCollectionRef, registrationData);
            console.log("Dáta úspešne uložené do Firestore s ID:", docRef.id);

            // Zobrazenie správy o úspešnom vyplnení formulára
            showMessage("Úspešné vyplnenie formulára!", "success");

            // Simulácia odosielania e-mailu
            console.log("Simulácia odosielania e-mailu...");
            console.log(`E-mail odoslaný na: ${email}`);
            console.log("Obsah e-mailu:");
            console.log(`E-mail: ${email}`);
            console.log(`Informácie o tíme: ${teamInfo}`);
            console.log("--- Koniec simulácie e-mailu ---");

            // Resetovanie formulára po úspešnom odoslaní
            registrationForm.reset();

        } catch (error) {
            console.error("Chyba pri ukladaní dát alebo simulácii odosielania e-mailu:", error);
            showMessage(`Chyba pri odosielaní formulára: ${error.message}`, "error");
        }
    });
});
