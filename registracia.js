// Konfigurácia pre Google Apps Script
// NAHRADTE TUTO URL VASOU SKUTOCNOU URL WEB APLIKACIE Z GOOGLE APPS SCRIPT!
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzPbN2BL4t9qRxRVmJs2CH6OGex-l-z21lg7_ULUH3249r93GKV_4B_Oenf6ydz0CyKrA/exec"; // <--- TÚTO URL SOM AKTUALIZOVAL

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
    const container = document.querySelector('.container'); // Získame kontajner formulára

    // Získame referencie na inputbox pre IČO, DIČ, IČ DPH
    const icoInput = document.getElementById('ico');
    const dicInput = document.getElementById('dic');
    const icDPHInput = document.getElementById('icDPH');
    const pscInput = document.getElementById('psc'); // Referencia na PSČ input

    // Pridáme event listener pre IČO: iba čísla, max 8 znakov
    if (icoInput) {
        icoInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').substring(0, 8);
        });
    }

    // Pridáme event listener pre DIČ: iba čísla, max 10 znakov
    if (dicInput) {
        dicInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').substring(0, 10);
        });
    }

    // Pridáme event listener pre IČ DPH: prvé 2 znaky písmená (automaticky na veľké), zvyšných 10 číslic, celkom 12 znakov
    if (icDPHInput) {
        icDPHInput.addEventListener('input', function() {
            let value = this.value;
            let formattedValue = '';

            // Spracovanie prvých dvoch znakov (iba písmená, automaticky na veľké)
            if (value.length > 0) {
                formattedValue += value.substring(0, 2).replace(/[^A-Za-z]/g, '').toUpperCase();
            }

            // Spracovanie zvyšných znakov (iba čísla)
            if (value.length > 2) {
                formattedValue += value.substring(2).replace(/\D/g, '');
            }

            this.value = formattedValue.substring(0, 12); // Obmedzenie celkovej dĺžky na 12
        });
    }

    // Pridáme event listener pre PSČ: iba čísla, formát xxx xx, celkom 6 znakov
    if (pscInput) {
        pscInput.addEventListener('input', function() {
            let value = this.value.replace(/\D/g, ''); // Odstráni všetky nečíselné znaky

            if (value.length > 5) { // Obmedzí surové číslice na 5
                value = value.substring(0, 5);
            }

            let formattedValue = '';
            if (value.length > 3) {
                formattedValue = value.substring(0, 3) + ' ' + value.substring(3); // Vloží medzeru po 3 čísliciach
            } else {
                formattedValue = value;
            }
            this.value = formattedValue;
        });

        // Pridáme 'keydown' listener, aby sa zabránilo písaniu za 6 znakov (vrátane medzery)
        pscInput.addEventListener('keydown', function(event) {
            // Povoliť backspace, delete, šípky, tab
            if (event.key === 'Backspace' || event.key === 'Delete' || event.key.startsWith('Arrow') || event.key === 'Tab') {
                return;
            }

            // Získať aktuálnu hodnotu bez medzier pre kontrolu dĺžky
            const currentValueWithoutSpace = this.value.replace(/\s/g, '');

            // Ak je aktuálna hodnota už 5 číslic a používateľ sa pokúša zadať ďalšiu číslicu, zabrániť tomu
            // Toto zabráni "010 012"
            if (currentValueWithoutSpace.length >= 5 && /\d/.test(event.key)) {
                event.preventDefault();
            }

            // Ak je aktuálna hodnota už 6 znakov (napr. "010 01"), zabrániť ďalšiemu písaniu (okrem backspace/delete)
            if (this.value.length >= 6 && event.key !== 'Backspace' && event.key !== 'Delete') {
                event.preventDefault();
            }
        });
    }

    // Používame appId z poskytnutej konfigurácie
    const appId = firebaseConfig.appId;

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

            // Získanie hodnôt nových polí a ich orezanie bielych znakov
            const ico = formData.get('ico').trim();
            const dic = formData.get('dic').trim();
            const icDPH = formData.get('icDPH').trim();
            const psc = formData.get('psc').trim(); // Získanie hodnoty PSČ

            // VALIDÁCIA: Minimálne jedno pole z IČO, DIČ, IČ DPH musí byť vyplnené
            if (!ico && !dic && !icDPH) {
                showMessage('Prosím vyplňte aspoň jedno z polí IČO, DIČ alebo IČ DPH.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                return; // Zastaví odosielanie formulára
            }

            // VALIDÁCIA: Formát IČO (ak je vyplnené)
            if (ico && !/^\d{8}$/.test(ico)) {
                showMessage('IČO musí obsahovať presne 8 číslic.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                return;
            }

            // VALIDÁCIA: Formát DIČ (ak je vyplnené)
            if (dic && !/^\d{10}$/.test(dic)) {
                showMessage('DIČ musí obsahovať presne 10 číslic.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                return;
            }

            // VALIDÁCIA: Formát IČ DPH (ak je vyplnené)
            if (icDPH && !/^[A-Z]{2}\d{10}$/.test(icDPH)) {
                showMessage('IČ DPH musí začínať 2 veľkými písmenami a nasledovať musí 10 číslic.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                return;
            }

            // VALIDÁCIA: Formát PSČ (ak je vyplnené, aj keď je required v HTML)
            if (psc && !/^\d{3}\s\d{2}$/.test(psc)) {
                showMessage('PSČ musí byť vo formáte xxx xx (napr. 010 01).', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                return;
            }


            // Dáta pre Firestore (objekt)
            const registrationDataForFirestore = {
                officialClubName: formData.get('officialClubName'),
                organizationName: formData.get('organizationName'),
                ico: ico, // Používame validované a orezané hodnoty
                dic: dic,
                icDPH: icDPH,
                address: { // Nový objekt pre adresné údaje
                    street: formData.get('street'),
                    houseNumber: formData.get('houseNumber'),
                    city: formData.get('city'),
                    psc: psc, // Používame validovanú a orezanú hodnotu
                    country: formData.get('country')
                },
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
                    body: formData, // formData obsahuje všetky polia z formulára
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
            if (firebaseInitialized && db && isAuthReady && currentUserId) {
                try {
                    const registrationsCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
                    await addDoc(registrationsCollectionRef, registrationDataForFirestore);
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
                // Skryjeme formulár
                registrationForm.classList.add('hidden');
                // Zobrazíme správu s poďakovaním
                showMessage(`
                    <h2 class="text-2xl font-bold text-center text-gray-800 mb-4">Ďakujeme za registráciu!</h2>
                    <p class="text-gray-700 mb-2">Vaša registrácia klubu/tímu bola úspešne prijatá.</p>
                    <p class="text-gray-700">Potvrdenie registrácie bolo odoslané na vašu e-mailovú adresu: <strong>${registrationDataForFirestore.email}</strong>.</p>
                    <p class="text-gray-700 mt-4">V prípade akýchkoľvek otázok nás neváhajte kontaktovať.</p>
                `, 'success');
                // Odstránime shadow z kontajnera pre čistejší vzhľad správy
                container.style.boxShadow = 'none';

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
     * @param {string} msg Text správy (môže obsahovať HTML).
     * @param {string} type Typ správy ('success', 'error', 'info').
     */
    function showMessage(msg, type) {
        messageDiv.innerHTML = msg; // Používame innerHTML, aby sme mohli vložiť HTML obsah
        messageDiv.className = `message ${type}`; // Nastaví triedu pre štýlovanie
        messageDiv.classList.remove('hidden');
    }
});
