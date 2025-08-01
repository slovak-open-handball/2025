// index.js
// Tento súbor bol upravený tak, aby načítal dáta o registrácii aj kategórie
// a podmienene zobrazil tlačidlo na registráciu na základe existencie kategórií.

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
 * Ak neexistujú žiadne kategórie, skryje tlačidlo na registráciu.
 */
const loadCategoriesData = async () => {
    // Skontrolujeme, či je inštancia Firestore databázy pripravená.
    if (window.db) {
        // Vytvorenie referencie na kolekciu 'categories' pod dokumentom 'settings'.
        const categoriesCollectionRef = collection(window.db, "settings", "categories");
        try {
            // Pokus o načítanie všetkých dokumentov z kolekcie.
            const querySnapshot = await getDocs(categoriesCollectionRef);
            
            // Kontrola, či existujú nejaké kategórie.
            if (!querySnapshot.empty) {
                console.log("Dáta kategórií:");
                const categories = [];
                querySnapshot.forEach((doc) => {
                    categories.push({ id: doc.id, ...doc.data() });
                });
                console.log(categories);

                // Ak existujú kategórie, uistíme sa, že tlačidlo je viditeľné.
                toggleRegistrationButton(true);

            } else {
                // Ak kolekcia neobsahuje žiadne dokumenty, vypíšeme správu a skryjeme tlačidlo.
                console.log("Žiadne kategórie neboli nájdené!");
                toggleRegistrationButton(false);
            }
        } catch (e) {
            // V prípade chyby pri načítaní vypíšeme detail chyby a skryjeme tlačidlo pre istotu.
            console.error("Chyba pri načítaní údajov o kategóriách:", e);
            toggleRegistrationButton(false);
        }
    }
};

/**
 * Prepína viditeľnosť tlačidla na registráciu na turnaj.
 * @param {boolean} isVisible - true pre zobrazenie, false pre skrytie.
 */
const toggleRegistrationButton = (isVisible) => {
    const registrationButton = document.getElementById('tournament-registration-button');
    if (registrationButton) {
        registrationButton.style.display = isVisible ? 'block' : 'none';
        console.log(`Tlačidlo 'Registrácia na turnaj' bolo ${isVisible ? 'zobrazené' : 'skryté'}.`);
    } else {
        console.log("Tlačidlo 'Registrácia na turnaj' nebolo nájdené v DOM.");
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
