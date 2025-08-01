// index.js
// Tento súbor bol upravený tak, aby obsahoval logiku špecifickú pre domovskú stránku
// po inicializácii Firebase a autentifikácii.

import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Načíta dátumové a časové údaje o registrácii z Firestore a vypíše ich do konzoly.
 * Čaká, kým je Firebase pripravené.
 */
const loadRegistrationData = async () => {
    // Skontrolujeme, či sú globálne premenné pre autentifikáciu a databázu pripravené.
    // Predchádzame tak chybám, ak by sa funkcia zavolala príliš skoro.
    if (window.isGlobalAuthReady && window.db) {
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
        // Ak Firebase nie je pripravené, vypíšeme správu a čakáme na udalosť.
        console.log("Firebase nie je pripravené, čakám na 'authReady' udalosť.");
    }
};

// Počúvame na udalosť 'authReady', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia je inicializovaná a pripravená.
window.addEventListener('authReady', () => {
    console.log("Udalosť 'authReady' bola prijatá.");
    // Po prijatí udalosti načítame dáta.
    loadRegistrationData();
});

// Volanie funkcie aj pri prvom spustení pre prípad, že sa autentifikácia dokončí
// skôr, ako sa stihne pripojiť listener.
if (window.isGlobalAuthReady) {
    loadRegistrationData();
}
