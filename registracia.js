// Konfigurácia pre Formspree
const FORMSPREE_FORM_URL = "https://formspree.io/f/xpwrgywn";
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

            try {
                const response = await fetch(FORMSPREE_FORM_URL, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json' // Dôležité pre získanie JSON odpovede od Formspree
                    }
                });

                if (response.ok) {
                    // Formulár bol úspešne odoslaný
                    showMessage('Úspešné odoslanie! Presmerovávam...', 'success');
                    // Presmerovanie na vašu vlastnú stránku po krátkej pauze
                    setTimeout(() => {
                        window.location.href = REDIRECT_URL;
                    }, 2000); // Presmeruje po 2 sekundách
                } else {
                    // Chyba pri odosielaní formulára
                    const data = await response.json();
                    let errorMessage = 'Nastala chyba pri odosielaní formulára.';
                    if (data.errors && data.errors.length > 0) {
                        errorMessage += ' ' + data.errors.map(err => err.message).join(', ');
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
