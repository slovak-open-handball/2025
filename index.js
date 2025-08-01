// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// po inicializácii Firebase a autentifikácii.

import { getDoc, getDocs, doc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
 * Načíta všetky kategórie z Firestore a vypíše ich do konzoly.
 */
const loadCategoriesData = async () => {
    // Skontrolujeme, či je inštancia Firestore databázy pripravená.
    if (window.db) {
        // Vytvorenie referencie na dokument, kde sú uložené kategórie.
        // Predpokladáme, že kategórie sú uložené v dokumente settings/registration.
        const docRef = doc(window.db, "settings", "registration");
        try {
            // Pokus o načítanie dokumentu.
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.categories && Array.isArray(data.categories)) {
                    // Ak dokument existuje a obsahuje pole 'categories', vypíšeme ho.
                    console.log("Dáta kategórií:", data.categories);
                } else {
                    console.log("Pole s kategóriami nebolo v dokumente nájdené!");
                }
            } else {
                console.log("Dokument o registrácii nebol nájdený, nemôžem načítať kategórie!");
            }
        } catch (e) {
            // V prípade chyby pri načítaní vypíšeme detail chyby.
            console.error("Chyba pri načítaní údajov o kategóriách:", e);
        }
    }
};

// Počúvame na udalosť 'globalDataUpdated', ktorá je vysielaná z authentication.js
// a signalizuje, že autentifikácia a načítanie profilu sú dokončené.
window.addEventListener('globalDataUpdated', () => {
    console.log("Udalosť 'globalDataUpdated' bola prijatá.");
    // Po prijatí udalosti načítame dáta o registrácii aj kategórie.
    loadRegistrationData();
    loadCategoriesData();
});

// Volanie funkcií aj pri prvom spustení pre prípad, že sa autentifikácia dokončí
// skôr, ako sa stihne pripojiť listener.
if (window.db) {
    loadRegistrationData();
    loadCategoriesData();
}
