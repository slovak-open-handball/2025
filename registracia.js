// Konfigurácia pre Google Apps Script
// NAHRADTE TUTO URL VASOU SKUTOCNOU URL WEB APLIKACIE Z GOOGLE APPS SCRIPT!
const GOOGLE_APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwkB7FLE-qB1y_RbazJmfBNp9dQkBducgq9HlhdEsdsd99ELae3RC7RuQemcAfztu_g/exec"; // Vložte sem vašu skopírovanú URL
const REDIRECT_URL = "https://slovak-open-handball.github.io/2025/index.html"; // Vaša cieľová URL

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('message');
    const submitButton = document.getElementById('submitButton');

    if (registrationForm) {
        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Zabraňuje predvolenému odoslaniu formulára

            // Zobrazí načítavanie
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Odosielam...';
            showMessage('Odosielam...', 'info'); // Zobrazí správu o odosielaní

            const formData = new FormData(registrationForm);
            // Pre Google Apps Script je lepšie posielať dáta ako URL-encoded form data
            // alebo ako JSON, ale pre jednoduchosť použijeme FormData a fetch API
            // ktoré to spracuje správne pre doPost.

            try {
                const response = await fetch(GOOGLE_APPS_SCRIPT_WEB_APP_URL, {
                    method: 'POST',
                    body: formData, // FormData sa automaticky spracuje ako multipart/form-data
                    // Ak by ste chceli posielať JSON, museli by ste to prekonvertovať:
                    // body: JSON.stringify(Object.fromEntries(formData)),
                    // headers: { 'Content-Type': 'application/json' }
                });

                // Odpoveď z Google Apps Script je textová, musíme ju parsovať ako JSON
                const result = await response.json();

                if (result.status === "success") {
                    // Formulár bol úspešne odoslaný
                    showMessage('Úspešné odoslanie! Presmerovávam...', 'success');
                    // Presmerovanie na vašu vlastnú stránku po krátkej pauze
                    setTimeout(() => {
                        window.location.href = REDIRECT_URL;
                    }, 2000); // Presmeruje po 2 sekundách
                } else {
                    // Chyba pri odosielaní formulára
                    let errorMessage = 'Nastala chyba pri odosielaní formulára.';
                    if (result.message) {
                        errorMessage += ' ' + result.message;
                    }
                    showMessage(errorMessage, 'error');
                    submitButton.disabled = false;
                    submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
                }
            } catch (error) {
                console.error('Chyba pri odosielaní formulára:', error);
                showMessage('Nastala chyba siete alebo iná neočakávaná chyba.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Odoslať registráciu';
            }
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
