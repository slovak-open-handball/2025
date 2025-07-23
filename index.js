// index.js
// Tento skript ukazuje, ako používať Firebase po tom, čo ho inicializoval header.js.

// Dôležité: NEinicializujte Firebase znova v tomto súbore!
// firebase.initializeApp(firebaseConfig); // <-- TENTO RIADOK ODSTRÁŇTE, AK HO MÁTE!

document.addEventListener('DOMContentLoaded', () => {
    console.log("index.js: DOM načítaný.");

    // Počkajte, kým sa Firebase inicializuje a overí stav autentifikácie.
    // Najlepší spôsob je použiť onAuthStateChanged.
    // Uistite sa, že header.js je načítaný PRED index.js.
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        const auth = firebase.auth(); // Získa už inicializovanú inštanciu Auth
        const db = firebase.firestore(); // Získa už inicializovanú inštanciu Firestore

        if (auth) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log("index.js: Používateľ je prihlásený:", user.uid);
                    // Tu môžete vykonať logiku pre prihláseného používateľa
                    // Napríklad, načítať dáta z Firestore
                    // db.collection("users").doc(user.uid).get().then(...)
                } else {
                    console.log("index.js: Používateľ nie je prihlásený.");
                    // Tu môžete vykonať logiku pre odhláseného používateľa
                }
            });
        } else {
            console.error("index.js: Firebase Auth nie je k dispozícii.");
        }
    } else {
        console.error("index.js: Firebase nie je inicializovaný. Uistite sa, že header.js je načítaný správne a ako prvý.");
    }

    // Príklad iného kódu pre index.js
    const welcomeMessage = document.createElement('h1');
    welcomeMessage.className = 'text-3xl font-bold text-center mt-8 text-gray-800';
    welcomeMessage.textContent = 'Vitajte na hlavnej stránke!';
    document.body.appendChild(welcomeMessage);
});
