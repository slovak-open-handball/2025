// Konfigurácia pre Google Apps Script
// NAHRADTE TUTO URL VASOU SKUTOCNOU URL WEB APLIKACIE Z GOOGLE APPS SCRIPT!
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyAOMdnSBBijJ21mO5gRg0FrdDo7Bp0VRWQdrVffIsKPwpb_PpwQo5JIPVl1jrPrdw/exec"; // Vložte sem vašu skopírovanú URL
const REDIRECT_URL = "https://slovak-open-handball.github.io/2025/index.html"; // Vaša cieľová URL

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// ** EXPLICITNÁ FIREBASE KONFIGURÁCIA **
// Táto konfigurácia je teraz priamo v kóde.
const firebaseConfig = {
    apiKey: "AIzaSyD0h0rQZiIGi0-UDb4-YU_JihRGpIlfz40",
    authDomain: "turnaj-a28c5.firebaseapp.com",
    projectId: "turnaj-a28c5",
    storageBucket: "turnaj-a28c5.firebasestorage.app",
    messagingSenderId: "13732191148",
    appId: "1:13732191148:web:5ad78eaef2ad452a10f809"
};

let db;
let auth;
let currentUserId = null;
let isAuthReady = false; // Flag to indicate if auth state is ready
let firebaseInitialized = false; // Flag pre úspešnú inicializáciu Firebase

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');
    // userIdDisplay bol odstránený, pretože ho už nebudeme zobrazovať

    // Používame appId z poskytnutej konfigurácie
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // Firebase Initialization
    if (firebaseConfig && Object.keys(firebaseConfig).length > 0) {
        try {
            const app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);
            firebaseInitialized = true; // Firebase je úspešne inicializované

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUserId = user.uid;
                    // userIdDisplay.textContent a .classList.remove('hidden') boli odstránené
                } else {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        try {
                            await signInWithCustomToken(auth, __initial_auth_token);
                            currentUserId = auth.currentUser?.uid;
                        } catch (error) {
                            console.error("Chyba pri prihlasovaní s vlastným tokenom:", error);
                            await signInAnonymously(auth);
                            currentUserId = auth.currentUser?.uid;
                        }
                    } else {
                        await signInAnonymously(auth);
                        currentUserId = auth.currentUser?.uid;
                    }
                }
                isAuthReady = true; // Stav autentifikácie je pripravený
            });
        } catch (error) {
            console.error("Chyba pri inicializácii Firebase:", error);
            showMessage('Chyba: Firebase sa nepodarilo inicializovať. Registrácia do databázy nebude fungovať.', 'error');
            firebaseInitialized = false;
        }
    } else {
        console.warn("Firebase konfigurácia nebola nájdená (neočakávaná chyba). Funkcionalita databázy bude vypnutá.");
        showMessage('Upozornenie: Firebase konfigurácia chýba. Registrácia do databázy nebude fungovať.', 'info');
        firebaseInitialized = false;
    }

    if (registrationForm) {
        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Zabraňuje predvolenému odoslaniu formulára

            // Zobrazí načítavanie
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Odosielam...';
            showMessage('Odosielam registráciu a ukladám dáta...', 'info'); // Zobrazí správu o odosielaní

            const formData = new FormData(registrationForm);
            const registrationData = {
                meno: formData.get('meno'),
                email: formData.get('email'),
                sprava: formData.get('sprava'),
                timestamp: serverTimestamp() // Uloží čas odoslania
            };

            let emailSuccess = false;
            let dbSuccess = false;
            let emailMessage = '';
            let dbMessage = '';

            // 1. Odoslanie e-mailu cez Google Apps Script
            try {
                const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (result.success) {
                    emailSuccess = true;
                    emailMessage = 'E-mail bol úspešne odoslaný.';
                } else {
                    emailMessage = `Chyba pri odosielaní e-mailu: ${result.message || 'Neznáma chyba.'}`;
                }
            } catch (error) {
                console.error('Chyba pri odosielaní e-mailu:', error);
                emailMessage = 'Chyba siete pri odosielaní e-mailu.';
            }

            // 2. Uloženie dát do Firestore
            // Vykonajte ukladanie do DB len ak je Firebase inicializované a autentifikácia je pripravená
            if (firebaseInitialized && db && isAuthReady && currentUserId) {
                try {
                    // Cesta k dátam: /artifacts/{appId}/public/data/registrations/{documentId}
                    const registrationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
                    await addDoc(registrationsCollectionRef, registrationData);
                    dbSuccess = true;
                    dbMessage = 'Dáta boli úspešne uložené do databázy.';
                } catch (error) {
                    console.error('Chyba pri ukladaní dát do databázy:', error);
                    dbMessage = `Chyba pri ukladaní dát do databázy: ${error.message}`;
                }
            } else {
                dbMessage = 'Dáta neboli uložené do databázy (Firebase nie je inicializované alebo používateľ nie je prihlásený).';
                console.warn(dbMessage);
            }

            // Zobrazenie výsledku
            if (emailSuccess && dbSuccess) {
                showMessage('Registrácia úspešná! ' + emailMessage + ' ' + dbMessage + ' Presmerovávam...', 'success');
                setTimeout(() => {
                    window.location.href = REDIRECT_URL;
                }, 2000);
            } else if (emailSuccess && !dbSuccess) {
                showMessage(`E-mail odoslaný, ale chyba pri ukladaní do DB: ${dbMessage}`, 'error');
            } else if (!emailSuccess && dbSuccess) {
                showMessage(`Dáta uložené do DB, ale chyba pri odosielaní e-mailu: ${emailMessage}`, 'error');
            } else {
                showMessage(`Chyba pri odosielaní e-mailu aj ukladaní do DB: ${emailMessage} ${dbMessage}`, 'error');
            }

            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
        });
    }

    /**
     * Zobrazí správu používateľovi.
     * @param {string} msg Text správy.
     * @param {string} type Typ správy ('success', 'error', 'info').
     */
    function showMessage(msg, type) {
        messageDiv.textContent = msg;
        messageDiv.className = `message ${type}`; // Nastaví triedu pre štýlovanie
        messageDiv.classList.remove('hidden');
    }
});
