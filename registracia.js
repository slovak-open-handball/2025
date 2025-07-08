// Konfigurácia pre Google Apps Script
// NAHRADTE TUTO URL VASOU SKUTOCNOU URL WEB APLIKACIE Z GOOGLE APPS SCRIPT!
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbykef4qqy5YPQrGJFCNlOfS1aKSmyprS359lxgiCm3KXfN7n5F4JhuRKNkv6vARdeGk/exec"; // Vložte sem vašu skopírovanú URL
const REDIRECT_URL = "https://slovak-open-handball.github.io/2025/index.html"; // Vaša cieľová URL

// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

let db;
let auth;
let currentUserId = null;
let isAuthReady = false; // Flag to indicate if auth state is ready

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');
    const userIdDisplay = document.getElementById('userIdDisplay');

    // Firebase Initialization
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

    if (Object.keys(firebaseConfig).length > 0) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                userIdDisplay.textContent = `Váš ID používateľa: ${currentUserId}`;
                userIdDisplay.classList.remove('hidden');
            } else {
                // Sign in anonymously if no custom token is provided
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    try {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } catch (error) {
                        console.error("Error signing in with custom token:", error);
                        await signInAnonymously(auth); // Fallback to anonymous
                    }
                } else {
                    await signInAnonymously(auth);
                }
            }
            isAuthReady = true; // Auth state is now ready
        });
    } else {
        console.error("Firebase config not found. Database functionality will be disabled.");
        showMessage('Chyba: Firebase konfigurácia chýba. Registrácia do databázy nebude fungovať.', 'error');
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
            if (db && isAuthReady && currentUserId) {
                try {
                    const registrationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
                    await addDoc(registrationsCollectionRef, registrationData);
                    dbSuccess = true;
                    dbMessage = 'Dáta boli úspešne uložené do databázy.';
                } catch (error) {
                    console.error('Chyba pri ukladaní dát do databázy:', error);
                    dbMessage = `Chyba pri ukladaní dát do databázy: ${error.message}`;
                }
            } else {
                dbMessage = 'Databáza nie je inicializovaná alebo používateľ nie je prihlásený.';
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
